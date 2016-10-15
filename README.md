# Highland Sucker

Highland Sucker is a utility to aid in finding performance bottlenecks in
[Highland](http://highlandjs.org/) pipelines.

Highland is awesome because it helps us create processing pipelines with
nodes that work at different speeds, and uses back-pressure to keep a
fast producer from overwhelming a slow consumer.

However, that backpressure means that a slow stream slows down all of
the other streams around it, making it hard to figure out where the
bottleneck is.

Highland Sucker aims to help address this problem by breaking a pipeline
into separate chunks that do not exert backpressure on each other, and
*sucking* all of the data from one before feeding it in bulk to the next.

Essentially this tool turns a concurrent pipeline into a sequential one,
buffering in memory between each step. It then collects timing information
for each step in isolation from the others, allowing you to see where the
bottleneck lies.

# Installation

As usual:

* `npm install --save highland-sucker`

# Usage

Sucker wants its streams to be interspersed between different parts of your
pipeline, so it can gather timing information at various points. A single
`Sucker` instance can have multiple "tap points" that will each separately
create a buffering/measurement point:

```js
var Sucker = require('sucker');
var fs = require('fs');
var _ = require('highland');

// One Sucker instance creates and coordinates multiple sequential tap points.
var sucker = Sucker();

var inp = _(fs.createReadStream('/usr/dict/words'));

inp
    .pipe(sucker('sourceFile'))
    .split().
    .pipe(sucker('split'))
    .map(function (x) {
        return x.toUpperCase();
    })
    .pipe(sucker('toUpperCase'))
    .each(function (x) {
        console.log(x);
    })
;

// sucker.results is a stream that recieves timing information
// about each tap point once its buffering is complete. The duration
// for a given tap point is the time between the given label and the
// one before it.
sucker.results.each(function (result) {
    console.log(result.label, 'took', result.durationMilli, 'ms');
});
```

The above might print something like this:

```
sourceFile took 2.50045 ms
split took 76.264812 ms
toUpperCase took 828.31935 ms
```

The `result` objects have the following properties:

* `label`: the string passed in when creating the tap using `sucker(...)`.

* `count`: the number of "records" that passed through the sucker.

* `errorCount`: the number of errors that passed through the sucker.

* `durationMilli`: the total duration from the arrival of the first event
  to the arrival of the "end of stream" event, in fractional milliseconds.

* `perSec`: the count divided by the duration in seconds, for convenient
  reference.

## Leaving the sucker in your program

Since a sucker tap point forces sequential processing, you should not leave
real tap points in your program when deploying it for real use. If you do,
the result will be unnecessarily high memory usage and much slower
overall stream processing.

However, it can be convenient to leave the instrumentation in a program for
repeated use over time. To accommodate this, Sucker provides a "no-op"
implementation that provides the same interface but simply pipes the data
through without interfering with it.

To use this, call `Sucker.noop` instead of `Sucker`. A no-op sucker will
create do-nothing taps and produce an empty `results` stream.

One way to use this is to put your pipeline into a factory function that
takes a sucker-like object as an argument, defaulting to a no-op sucker.
Then certain callers can provide a *real* sucker in order to do pipeline
timing measurements, while most callers will not need to worrk about the
sucker at all.

# License

Copyright 2016 Say Media, Inc.

This program is distributed under the terms of the MIT license. For full
details, see [LICENSE](LICENSE).
