
var _ = require('highland');

function Sucker() {
    var sucker;
    var results = _();
    var suckerCount = 0;
    var closedCount = 0;

    sucker = function (label) {
        var buf = [];
        var startTime;
        var recordCount = 0;
        var errorCount = 0;
        suckerCount++;

        var drain;
        var out = _(function (push, next) {
            drain = function () {
                var count = buf.length;
                for (var i = 0; i < count; i++) {
                    push(buf[i][0], buf[i][1]);
                }
                // Make sure this gets to be garbage collected,
                // even if some callbacks are still holding on to us.
                // (This is just paranoia, really.)
                buf = undefined;

                push(null, _.nil);
            };
        });

        // This pipeline is actually "broken" in the middle...
        // the first _.consume gobbles all of the input it can
        // as fast as possible, but emits nothing. Then once
        // it reaches EOF we'll emit all of the buffered data
        // into the "out" stream, which is disconnected from
        // the input so that it can't exert backpressure onto
        // the input.
        return _.pipeline(
            _.consume(
                function (err, x, push, next) {
                    if (! startTime) {
                        startTime = process.hrtime();
                    }

                    if (x === _.nil) {
                        var duration = process.hrtime(startTime);
                        var durationNano = duration[0] * 1e9 + duration[1];
                        var durationMilli = durationNano / 1e6;
                        var perSec = recordCount / (durationNano / 1e9);
                        results.write(
                            {
                                label: label,
                                count: recordCount,
                                errorCount: errorCount,
                                durationMilli: durationMilli,
                                perSec: perSec,
                            }
                        );
                        drain();
                        closedCount++;
                        if (suckerCount === closedCount) {
                            // All done!
                            results.write(_.nil);
                        }
                        return;
                    }

                    buf.push([err, x]);
                    if (err !== null) {
                        errorCount++;
                    }
                    else {
                        recordCount++;
                    }
                    next();
                }
            ),
            out
        );
    };

    sucker.results = results;

    return sucker;
}

Sucker.noop = function () {
    function fakeSucker() {
        return _.pipeline();
    }

    fakeSucker.results = _([]);

    return fakeSucker;
};

module.exports = Sucker;
