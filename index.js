
/**
 * Represents a subscription to messages
 */
class Subscription {
	/**
	 * Creates an instance of Subscription.
	 *
	 * @param {Subscriber} subscriber - The subscriber for this subscription
	 * @param {string} type - The message type for this subscription
	 */
	constructor(subscriber, type) {
		this._subscriber = subscriber;
		this._type = type;
	}

	/**
	 * Unsubscribe this subscription
	 */
	unsubscribe() {
		this._subscriber.unsubscribe(this._type);
	}

	/**
	 * Signal that the subscriber has completed work on a message from this
	 * subscription and is ready to receive more messages from this subscription
	 */
	complete() {
		this._subscriber.complete(this._type);
	}
}

let id = 0;

/**
 * A subscriber can have zero or more subscriptions
 */
class Subscriber {
	/**
	 * Creates an instance of Subscriber.
	 *
	 * @param {Dealer} dealer - The dealer for this subscriber
	 */
	constructor(dealer) {
		this._dealer = dealer;
		this._id = ++id;
	}

	/**
	 * Subscribe to messages of the specified type with the specified concurrency
	 *
	 * @param {string} type - The message type to subscribe to
	 * @param {number} [concurrency=1] - The maximum number of concurrent messages this subsciption will receive
	 * @param {function} handler - The callback function to receive messages
	 * @returns {Subscription} - A Subscription instance
	 */
	subscribe(type, concurrency, handler) {
		this._dealer.subscribe(this._id, type, concurrency, handler);

		return new Subscription(this, type);
	}

	/**
	 * Unsubscribe from messages of the specified type
	 *
	 * @param {string} type - The message type to unsubscribe from
	 */
	unsubscribe(type) {
		this._dealer.unsubscribe(this._id, type);
	}

	/**
	 * Signal that the subscriber has completed work on a message of the
	 * specified message type and is ready to receve more messages of the type
	 *
	 * @param {string} type - The message type to signal completion
	 */
	complete(type) {
		this._dealer.complete(this._id, type);
	}
}

/**
 * The dealer pulls messages and deals pulled messages round-robin to a
 * set of subscribers. Subscribers subscribe to specific message types and
 * specify concurrency. Subscribers notify the dealer when they have completed
 * working with a message. The dealer enforces concurrency per subscription.
 */
class Dealer {
	/**
	 * Creates an instance of Dealer
	 *
	 * @param {Object|function} [options] - Optional parameters
	 * @param {function} [options.pull] - Function to pull messages
	 * @param {number} [options.interval=1000] - Check interval in milliseconds
	 * @param {Array} [options.messages] - Array of messages to pre-load the dealer
	 * @param {function|string} [options.typeSelector='type'] - Function or property name to retreive type from a message instance
	 * @param {boolean} [options.start=false] - Whether to start immediately
	 */
	constructor(options) {
		options = options || {};
		if (typeof options == 'function') {
			options = { pull: options };
		}
		this._pull = options.pull || this._pullFromMessages;
		this._interval = options.interval || 1000;
		this._subscriptions = [];
		this._messages = options.messages || [];
		this._started = false;
		this._checking = false;
		this._typeSelector = message => message.type;
		if (options.typeSelector) {
			this._typeSelector =
				typeof options.typeSelector == 'function' ?
				options.typeSelector :
				message => message[options.typeSelector];
		}

		this.check = this.check.bind(this);

		if (options.start) { setImmediate(this.start.bind(this)); }
	}

	/**
	 * Starts the dealer
	 */
	start() {
		if (!this._started) {
			this._started = true;

			const timer = setInterval(this.check, this._interval);
			timer.unref();

			this.check();
		}
	}

	/**
	 * Stops the dealer
	 */
	stop() {
		this._started = false;

		clearInterval(this.check);
	}

	/**
	 * Creates a subscriber
	 *
	 * @returns {Subscriber} - A Subscriber instance
	 */
	createSubscriber() {
		return new Subscriber(this);
	}

	/**
	 * Subscribe to messages of the specified type with the specified concurrency
	 *
	 * @param {number|string} subscriber - The ID of the subscriber
	 * @param {string} type - The message type to subscribe to
	 * @param {number} [concurrency=1] - The maximum number of concurrent messages this subsciption will receive
	 * @param {function} handler - The callback function to receive messages
	 */
	subscribe(subscriber, type, concurrency, handler) {
		this._subscriptions.push({
			subscriber,
			type,
			concurrency: concurrency || 1,
			current: 0,
			handler
		});
	}

	/**
	 * Unsubscribe from messages of the specified type
	 *
	 * @param {number|string} subscriber - The ID of the subscriber
	 * @param {string} type - The message type to unsubscribe from
	 */
	unsubscribe(subscriber, type) {
		this._subscriptions.forEach((subscription, index) => {
			if (subscription.subscriber == subscriber && (!type || subscription.type == type)) {
				this._subscriptions.splice(index, 1);
			}
		});
	}

	/**
	 * Get a list of current subscriptions
	 *
	 * @returns {array} - The current subscriptions
	 */
	getSubscriptions() {
		return this._subscriptions.map(
			({ subscriber, type, concurrency, current }) => ({ subscriber, type, concurrency, current })
		);
	}

	_getWaitingSubscriptionTypes() {
		const waitingSubscriptionTypes =
			this._subscriptions.reduce((waitingSubscriptionTypes, subscription) => {
				if (this._isWaitingSubscription(subscription)) {
					waitingSubscriptionTypes.add(subscription.type);
				}
				return waitingSubscriptionTypes;
			}, new Set());

		return Array.from(waitingSubscriptionTypes);
	}

	_isWaitingSubscription(subscription) {
		return subscription.current < subscription.concurrency;
	}

	/**
	 * Initiate a check for messages
	 */
	check() {
		// Prevent overlapping checks
		if (this._checking) { return; }

		const types = this._getWaitingSubscriptionTypes();

		// No waiting subscriptions
		if (types.length == 0) { return; }

		this._checking = true;

		this._pull(types, (err, message) => {
			this._checking = false;

			if (err) { return; /* TODO: should emit error */ }

			if (!message) { return; }

			// When there's one, there's likely to be more
			setImmediate(this.check);

			this._deal(message);
		});
	}

	_findWaitingSubscriptionIndex(type) {
		return this._subscriptions.findIndex(subscription =>
			subscription.type == type &&
			this._isWaitingSubscription(subscription)
		);
	}

	_pullFromMessages(types, callback) {
		if (this._messages.length == 0) { return callback(); }

		const typeMap = types.reduce((types, type) => { types[type] = true; return types; }, {});

		const index = this._messages.findIndex(message => typeMap[this._typeSelector(message)]);

		if (index == -1) { return callback(); }

		const message = this._messages[index];

		this._messages.splice(index, 1);

		callback(null, message);
	}

	/**
	 * Push a message to the dealer
	 *
	 * @param {Object} message - The message to push to the dealer
	 */
	push(message) {
		this._messages.push(message);
	}

	_deal(message) {
		const type = this._typeSelector(message);

		// Find the first matching waiting subscription
		const index = this._findWaitingSubscriptionIndex(type);

		if (index == -1) {
			// No matching subscription
			// TODO: release the message
			return;
		}

		const subscription = this._subscriptions[index];

		// Remove subscription from the queue
		this._subscriptions.splice(index, 1);
		// And add it back to the end of the queue
		this._subscriptions.push(subscription);

		// Increment subscription current message count
		++subscription.current;

		if (subscription.handler.length >= 2) {
			subscription.handler(message, () => this.complete(subscription.subscriber, subscription.type));
		}
		else {
			subscription.handler(message);
		}
	}

	/**
	 * Signal to the dealer that the subscriber has completed work on a message
	 * of the specified message type and is ready to receve more messages of
	 * the type
	 *
	 * @param {number|string} subscriber - The ID of the subscriber
	 * @param {string} type - The message type to signal completion
	 */
	complete(subscriber, type) {
		const subscription =
			this._subscriptions.find(subscription =>
				subscription.subscriber == subscriber &&
				subscription.type == type &&
				subscription.current > 0
			);

		if (subscription) {
			--subscription.current;
		}
	}
}

module.exports = Dealer;
