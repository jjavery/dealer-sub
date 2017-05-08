
const assert = require('chai').assert;

const Dealer = require('../');

describe('Dealer', function () {

	it('creates a dealer', function () {
		const dealer = new Dealer();

		assert.isNotNull(dealer);
	});

	it('creates a subscriber', function () {
		const dealer = new Dealer();
		const subscriber = dealer.createSubscriber();

		assert.isNotNull(subscriber);
	});

	it('creates a subscription', function () {
		const dealer = new Dealer();
		const subscriber = dealer.createSubscriber();
		const subscription = subscriber.subscribe('test', 1, () => {});

		assert.isNotNull(subscription);
	});

	it('gets the current subscriptions', function () {
		const dealer = new Dealer();
		const subscriber = dealer.createSubscriber();
		subscriber.subscribe('test', 1, () => {});
		const subscriptions = dealer.getSubscriptions();

		assert.isArray(subscriptions);
		assert.lengthOf(subscriptions, 1);
	});

	it('unsubscribes', function () {
		const dealer = new Dealer();
		const subscriber = dealer.createSubscriber();
		const subscription = subscriber.subscribe('test', 1, () => {});
		subscription.unsubscribe();
		assert.equal(dealer.getSubscriptions().length, 0);
	});

	it('checks for waiting messages when there are waiting subscriptions', function (done) {
		const dealer = new Dealer(types => {
			assert.isArray(types);
			done();
		});
		const subscriber = dealer.createSubscriber();
		subscriber.subscribe('test', 1, () => {});

		dealer.check();
	});

	it('does not check for waiting messages when there are no waiting subscriptions', function () {
		const dealer = new Dealer(() => {
			assert.isOk(false);
		});
		dealer.check();
	});

	it('deals a message', function (done) {
		const dealer = new Dealer();
		const subscriber = dealer.createSubscriber();
		subscriber.subscribe('test', 1, message => {
			assert.isNotNull(message);
			done();
		});

		dealer._deal({ type: 'test' });
	});

	it('completes a message by calling its complete callback', function (done) {
		const dealer = new Dealer();
		const subscriber = dealer.createSubscriber();
		subscriber.subscribe('test', 1, (message, complete) => {
			assert.isNotNull(message);
			complete();
			const subscriptions = dealer.getSubscriptions();
			assert.equal(subscriptions[0].current, 0);
			done();
		});

		dealer._deal({ type: 'test' });
	});

	it('completes a message by calling complete', function (done) {
		const dealer = new Dealer();
		const subscriber = dealer.createSubscriber();
		const subscription = subscriber.subscribe('test', 1, message => {
			assert.isNotNull(message);
			subscription.complete();
			const subscriptions = dealer.getSubscriptions();
			assert.equal(subscriptions[0].current, 0);
			done();
		});

		dealer._deal({ type: 'test' });
	});

	it('checks for and deals a message', function (done) {
		const messages = [ { type: 'test' } ];

		const dealer = new Dealer((types, callback) => {
			callback(null, messages.shift());
		});

		const subscriber = dealer.createSubscriber();
		subscriber.subscribe('test', 1, message => {
			assert.isNotNull(message);
			done();
		});

		dealer.check();
	});

	it('uses a pull function', function (done) {
		const messages = [ { type: 'test' } ];

		const dealer = new Dealer({
			pull: (types, callback) => { callback(null, messages.shift()); }
		});

		const subscriber = dealer.createSubscriber();
		subscriber.subscribe('test', 1, message => {
			assert.isNotNull(message);
			done();
		});

		dealer.check();
	});

	it('uses a type selector function', function (done) {
		const dealer = new Dealer({ typeSelector: message => message.class });
		const subscriber = dealer.createSubscriber();
		subscriber.subscribe('test', 1, message => {
			assert.isNotNull(message);
			done();
		});

		dealer._deal({ class: 'test' });
	});

	it('uses a type selector string', function (done) {
		const dealer = new Dealer({ typeSelector: 'class' });
		const subscriber = dealer.createSubscriber();
		subscriber.subscribe('test', 1, message => {
			assert.isNotNull(message);
			done();
		});

		dealer._deal({ class: 'test' });
	});

	it('checks for and deals a message using an interval', function (done) {
		const messages = [ { type: 'test' } ];

		const dealer = new Dealer({
			pull: (types, callback) => { callback(null, messages.shift()); },
			start: true
		});

		const subscriber = dealer.createSubscriber();
		subscriber.subscribe('test', 1, message => {
			assert.isNotNull(message);
			done();
		});
	});

	it('uses an initial messages array', function (done) {
		const messages = [ { type: 'test' } ];

		const dealer = new Dealer({ messages, start: true });

		const subscriber = dealer.createSubscriber();
		subscriber.subscribe('test', 1, message => {
			assert.isNotNull(message);
			done();
		});
	});

});
