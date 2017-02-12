"use strict";

function bf_relax(cost, residual, workers, jobs, workers_prev, jobs_prev) {
    var n = cost.length;
    var w, j, s;
    for (w = 0; w < n; ++w) {
        for (j = 0; j < n; ++j) {
            if (residual[w][j] === 1) {
                s = workers[w] + cost[w][j]|0;
                if (s < jobs[j]) {
                    jobs[j] = s;
                    jobs_prev[j] = w;
                }
            }
        }
    }
    for (w = 0; w < n; ++w) {
        for (j = 0; j < n; ++j) {
            if (residual[w][j] === -1) {
                s = jobs[j] - cost[w][j]|0;
                if (s < workers[w]) {
                    workers[w] = s;
                    workers_prev[w] = j;
                }
            }
        }
    }
}

function bf(cost, residual_work, residual, residual_job) {
    // Bellman–Ford algorithm
    var n = cost.length;
    var i, j, w, s;

    // Infinity
    var max_cost = cost[0][0]|0;
    for (w = 0; w < n; ++w) {
        for (j = 0; j < n; ++j) {
            max_cost = Math.max(max_cost, cost[w][j]|0)|0;
        }
    }

    // Distances
    var sink = n * max_cost;
    var workers = [];
    var jobs = [];

    // Previous for path reconstruction
    var source_prev = -1;
    var sink_prev = -1;
    var jobs_prev = [];
    var workers_prev = [];

    for (i = 0; i < n; ++i) {
        workers[i] = n * max_cost;
        jobs[i] = n * max_cost;
        jobs_prev[i] = -1;
        workers_prev[i] = -1;
    }

    // these edges can be relaxed only once
    for (w = 0; w < n; ++w) {
        if (residual_work[w] === 1) {
            if (0 < workers[w]) {
                workers[w] = 0;
                workers_prev[w] = -1;
            }
        } else {
            // addmit no negative loops
        }
    }

    // n relaxation should be enough
    for (i = 0; i < n; ++i) {
        bf_relax(cost, residual, workers, jobs, workers_prev, jobs_prev);

        for (j = 0; j < n; ++j) {
            if (residual_job[j] === 1) {
                if (jobs[j] < sink) {
                    sink = jobs[j];
                    sink_prev = j;
                }
            } else {
                // edge [sink -> job[j]] ignored
            }
        }

    }

    var path_jobs = [];
    var path_workers = [];

    var pos = sink_prev;
    while (true) {
        path_jobs.push(pos);

        pos = jobs_prev[pos];

        path_workers.push(pos);
        pos = workers_prev[pos];
        if (pos === -1) {
            break;
        }
    }
    return {
        path_jobs: path_jobs,
        path_workers: path_workers
    };
}

function reduce(matrix) {
    var n = matrix.length;
    var w, j;

    var cost = [];
    var max_cost = -Infinity;
    for (w = 0; w < matrix.length; ++w) {
        cost[w] = [];
        for (j = 0; j < matrix[w].length; ++j) {
            cost[w][j] = matrix[w][j];
            max_cost = Math.max(max_cost, cost[w][j]);
        }
        n = Math.max(n, cost[w].length);
    }
    max_cost = max_cost;

    // not enough workers => add indiferent workers
    for (w = cost.length; w < n; ++w) {
        cost[w] = [];
        for (j = 0; j < n; ++j) {
            cost[w][j] = 0;
        }
    }
    for (w = 0; w < n; ++w) {
        // not enough jobs => add high cost jobs
        for (j = cost[w].length; j < n; ++j) {
            cost[w][j] = max_cost;
        }
    }
    return cost;
}

function ssp(matrix) {
    var i, k, j, w;

    var cost = reduce(matrix);
    var n = cost.length;

    var residual_work = [];
    var residual = [];
    var residual_job = [];
    // 1 = right arrow
    // -1 = left arrow

    for (i = 0; i < n; ++i) {
        residual_work[i] = 1;
        residual_job[i] = 1;
        residual[i] = [];
        for (j = 0; j < n; ++j) {
            // edge from worker i to job j is a right arrow
            residual[i][j] = 1;
        }
    }

    for (i = 0; i < n; ++i) {
        var path = bf(cost, residual_work, residual, residual_job);

        j = path.path_jobs[0];
        residual_job[j] = -1;

        w = path.path_workers[0];
        residual[w][j] = -1;

        for (k = 1; k < path.path_jobs.length; ++k) {
            j = path.path_jobs[k];
            residual[w][j] = 1;
            w = path.path_workers[k];
            residual[w][j] = -1;
        }

        residual_work[w] = -1;
    }

    var result = [];
    for (w = 0; w < matrix.length; ++w) {
        j = residual[w].indexOf(-1);
        if (j < matrix[w].length) {
            result[w] = j;
        } else {
            result[w] = -1;
        }
    }
    return result;
}






function Test() {
    function ArrayEquals(a, b) {
        if (a.length == b.length) {
            for (var i = 0; i < a.length; ++i) {
                if (a[i] != b[i]) {
                    return false;
                }
            }

            return true;
        }

        return false;
    }

    function Assert(matrix, solution) {

        var s = ssp(matrix);

        if (ArrayEquals(solution, s)) {
            console.log("Solution correct.");
        } else {
            console.log("Failed: ", matrix, solution, s);
        }
    }

    /// Some tests copied from: http://www.fantascienza.net/leonardo/so/hungarian.d
    Assert([
        [],
        []
    ], [-1, -1]);
    Assert([
        [1]
    ], [0]);
    Assert([
        [1],
        [1]
    ], [0, -1]);
    // Assert([
    //     [1, 1]
    // ], [0]);
    Assert([
        [1, 1],
        [1, 1]
    ], [0, 1]);
    Assert([
        [1, 1],
        [1, 1],
        [1, 1]
    ], [0, 1, -1]);
    Assert([
        [1, 2, 3],
        [6, 5, 4]
    ], [0, 2]);
    Assert([
        [1, 2, 3],
        [6, 5, 4],
        [1, 1, 1]
    ], [0, 2, 1]);
    // Assert([
    //     [1, 2, 3],
    //     [6, 5, 4],
    //     [1, 1, 1]
    // ], [0, 2, 1]);
    Assert([
        [10, 25, 15, 20],
        [15, 30, 5, 15],
        [35, 20, 12, 24],
        [17, 25, 24, 20]
    ], [0, 2, 1, 3]);

}

// Test();
