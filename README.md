# dealer-sub

Dealer-subscriber

## Installation

```sh
$ npm install jjavery/dealer-sub --save
```

## Usage

```javascript
const Dealer = require('dealer-sub');

function pull(types, callback) {
  // Go to database, message queue, etc. and try to pull a message of a
  // type specified in the types array.
  // Pull means don't pass the same message twice (under normal
  // circumstances)
  // Call callback(err, message) if a message is found or callback(err, null)
  // if no message found.
}

// Dealer will call pull once per second if subscriptions are waiting
const dealer = new Dealer({ pull });

// A subscriber "owns" zero or more subscriptions
const subscriber = dealer.createSubscriber();

// Subscribe to 1 concurrent message of type 'example'
const subscription = subscriber.subscribe('example', 1, (message, complete) => {
  // Do something with the message...

  // When done, signal ready for more
  complete();
});

// Sometime later...
subscription.unsubscribe();

// It's also possible to push messages to the dealer. This is useful only when the
// dealer is not provided with a pull function.
const message = { type: 'example' };
dealer.push(message);
```
