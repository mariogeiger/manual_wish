function parse(text) {
    "use strict";
    var errors = [];

    var ch = text.length === 0 ? null : text[0];
    var k = 0;
    var l = 0;
    var c = 0;

    var vmin = null;
    var vmax = null;
    var wishes = null;

    var vmin_pos = null;

    var vmin_sum = 0;
    var vmax_sum = 0;

    function eat() {
        if (ch === "\n") {
            l++;
            c = 0;
        } else {
            c++;
        }
        k++;
        if (k < text.length) {
            ch = text[k];
        } else {
            ch = null;
        }
    }

    function eat_line() {
        while (is_space(ch)) {
            eat();
        }
        if (ch === "\n") {
            eat();
            return;
        }
        if (ch === "#") {
            skip_line();
            return;
        }
        if (ch !== null) {
            eat_row();
        }
    }

    function eat_row() {
        var i;
        var cc;
        if (!is_digit(ch)) {
            cc = c;
            skip_line();
            errors.push({
                from: CodeMirror.Pos(l, cc),
                to: CodeMirror.Pos(l, c),
                message: "A row must begin with a number"
            });
            return;
        }

        var row = [];
        var x = eat_number();
        if (isNaN(x)) {
            skip_line();
            return;
        }
        row.push(x);
        while (is_space(ch)) {
            eat();
        }
        while (ch === "," || ch === ";") {
            cc = c;
            eat(); // eat the comma
            while (is_space(ch)) {
                eat();
            }

            if (!is_digit(ch)) {
                errors.push({
                    from: CodeMirror.Pos(l, cc),
                    to: CodeMirror.Pos(l, c),
                    message: "After a comma, a number is expected"
                });
                skip_line();
                return;
            }

            x = eat_number();
            if (isNaN(x)) {
                skip_line();
                return;
            }
            row.push(x);
            cc = c;
            while (is_space(ch)) {
                eat();
            }
        }

        if (ch === "#") {
            skip_line();
        }
        if (ch !== "\n" && ch !== null) {
            cc = c;
            skip_line();
            errors.push({
                from: CodeMirror.Pos(l, cc),
                to: CodeMirror.Pos(l, c),
                message: "This is not a valid content"
            });
            return;
        }

        if (vmin !== null && vmin.length !== row.length) {
            errors.push({
                from: CodeMirror.Pos(l, 0),
                to: CodeMirror.Pos(l, cc),
                message: "All the lines must contain the same amount of values"
            });
            return;
        }
        if (vmin === null) {
            vmin = row;
            vmin_pos = {
                line: l,
                column: cc
            };
            vmin_sum = 0;
            for (i = 0; i < vmin.length; ++i) {
                vmin_sum += vmin[i];
            }
        } else if (vmax === null) {
            vmax = row;
            vmax_sum = 0;
            for (i = 0; i < vmax.length; ++i) {
                vmax_sum += vmax[i];
            }
            for (i = 0; i < vmin.length; ++i) {
                if (vmax[i] < vmin[i]) {
                    errors.push({
                        from: CodeMirror.Pos(l, 0),
                        to: CodeMirror.Pos(l, cc),
                        message: "vmax must be greater or equal than vmin"
                    });
                }
            }
        } else {
            if (wishes === null) {
                wishes = [];
            }
            wishes.push(row);
            if (wishes.length > vmax_sum) {
                errors.push({
                    from: CodeMirror.Pos(l, 0),
                    to: CodeMirror.Pos(l, cc),
                    message: "vmax is too small or there is too much entries"
                });
            }
            var tmp = row.slice();
            tmp.sort();
            for (i = 0; i < tmp.length; ++i) {
                if (tmp[i] > i) {
                    errors.push({
                        from: CodeMirror.Pos(l, 0),
                        to: CodeMirror.Pos(l, cc),
                        severity: "warning",
                        message: "This wish is not fair"
                    });
                    break;
                }
            }
        }
    }

    function is_space(ch) {
        return ch === " " || ch === "\t";
    }

    function is_digit(ch) {
        return ch !== null && (ch >= "0" && ch <= "9");
    }

    function eat_number() {
        var entry = ch;
        eat();
        while (is_digit(ch)) {
            entry += ch;
            eat();
        }
        var num = Number(entry);
        if (isNaN(num) || num < 0 || entry[0] === "\n") {
            errors.push({
                from: CodeMirror.Pos(l, c - entry.length),
                to: CodeMirror.Pos(l, c),
                message: "'" + entry + "' is not a non-negative number"
            });
            return NaN;
        }
        return num;
    }

    function skip_line() {
        while (ch !== "\n" && ch !== null) {
            eat();
        }
    }

    while (ch !== null) {
        eat_line();
    }

    if (vmin === null) {
        errors.push({
            from: CodeMirror.Pos(l, 0),
            to: CodeMirror.Pos(l, 0),
            message: "vmin expected"
        });
    } else if (vmax === null) {
        errors.push({
            from: CodeMirror.Pos(l, 0),
            to: CodeMirror.Pos(l, 0),
            message: "vmax expected"
        });
    } else if (wishes === null) {
        errors.push({
            from: CodeMirror.Pos(l, 0),
            to: CodeMirror.Pos(l, 0),
            message: "wishes expected"
        });
    } else if (wishes.length < vmin_sum) {
        errors.push({
            from: CodeMirror.Pos(vmin_pos.line, 0),
            to: CodeMirror.Pos(vmin_pos.line, vmin_pos.column),
            message: "vmin is too high for the amount of entries"
        });
    }

    var res = {
        vmin: vmin,
        vmax: vmax,
        wishes: wishes
    };

    return [res, errors];
}

(function() {
    "use strict";

    CodeMirror.defineMode("csv", function() {
        return {
            startState: function() {
                return {
                    commentLine: false
                };
            },
            token: function(stream, state) {
                if (stream.sol()) {
                    state.commentLine = false;
                }
                var ch = stream.next().toString();
                if (state.commentLine) {
                    return "comment";
                }
                if (ch === "#") {
                    state.commentLine = true;
                    return "comment";
                }
                if (ch === "," || ch === ";") {
                    return "keyword";
                }
                return "atom";
            }
        };
    });

    CodeMirror.registerHelper("lint", "csv", function(text) {
        return parse(text)[1];
    });
}());

function shuffle(a) {
    "use strict";

    var j, x, i;
    for (i = a.length; i; i--) {
        j = Math.floor(Math.random() * i);
        x = a[i - 1];
        a[i - 1] = a[j];
        a[j] = x;
    }
}

function action(wishes, results) {
    "use strict";

    var i;
    var score = 0;
    for (i = 0; i < wishes.length; ++i) {
        score += Math.pow(wishes[i][results[i]], 2);
    }
    return score;
}

var inputCode = null;
var outputCode = null;

function button_pressed() {
    "use strict";

    var i, j, k;
    var text = inputCode.getValue();
    var out = parse(text);

    var ok = true;
    for (i = 0; i < out[1].length; ++i) {
        if (out[1][i].severity !== "warning") {
            ok = false;
        }
    }

    if (!ok) {
        inputCode.focus();
        inputCode.setCursor(out[1][0].from);
    } else {
        var vmin = out[0].vmin;
        var vmax = out[0].vmax;
        var wishes = out[0].wishes;

        var vmin_tot = 0;
        for (i = 0; i < vmin.length; ++i) {
            vmin_tot += vmin[i];
        }
        var vmax_tot = 0;
        for (i = 0; i < vmax.length; ++i) {
            vmax_tot += vmax[i];
        }

        var permutation = [];
        for (i = 0; i < wishes.length; ++i) {
            permutation.push(i);
        }
        shuffle(permutation);

        var x = Math.pow(vmin.length, 2);
        for (i = 0; i < wishes.length; ++i) {
            for (j = 0; j < vmin.length; ++j) {
                x = Math.max(x, Math.pow(wishes[i][j], 2));
            }
        }

        var cost = [];
        for (i = 0; i < wishes.length; ++i) {
            var row = [];
            for (j = 0; j < vmin.length; ++j) {
                var c = Math.pow(wishes[i][j], 2);
                for (k = 0; k < vmin[j]; ++k) {
                    row.push(c);
                }
                for (k = vmin[j]; k < vmax[j]; ++k) {
                    row.push(x + c);
                }
            }
            cost[permutation[i]] = row;
        }

        var start_time = new Date().getTime();
        var h = new Hungarian(cost);
        var solution = h.execute();
        // var solution = ssp(cost);
        var dt = new Date().getTime() - start_time;

        console.log(dt + " ms");

        for (i = 0; i < solution.length; ++i) {
            for (j = 0; j < vmax.length; ++j) {
                if (solution[i] >= vmax[j]) {
                    solution[i] -= vmax[j];
                } else {
                    solution[i] = j;
                    break;
                }
            }
        }

        var result = [];
        for (i = 0; i < wishes.length; ++i) {
            result[i] = solution[permutation[i]];
        }

        var score = action(wishes, result);

        text = "# attribution,score\n";
        for (i = 0; i < result.length; ++i) {
            text += result[i] + "," + wishes[i][result[i]] + "\n";
        }
        outputCode.setValue(text);

        var info = document.getElementById('info');
        info.value = "";

        info.value += "Total score : " + score + "\n\n";

        var choices = [];
        var s;
        for (i = 0; i < result.length; ++i) {
            s = wishes[i][result[i]];
            if (choices[s] === undefined) {
                choices[s] = 0;
            }
            choices[s]++;
        }
        for (j = 0; j < choices.length; ++j) {
            if (choices[j] === undefined) {
                choices[j] = 0;
            }
        }
        info.value += "Satisfaction distribution : " + choices.join(" ") + "\n\n";

        for (i = 0; i < vmin.length; ++i) {
            choices = [];
            var counter = 0;
            for (j = 0; j < result.length; ++j) {
                if (result[j] === i) {
                    s = wishes[j][i];
                    if (choices[s] === undefined) {
                        choices[s] = 0;
                    }
                    choices[s]++;
                    counter++;
                }
            }
            for (j = 0; j < choices.length; ++j) {
                if (choices[j] === undefined) {
                    choices[j] = 0;
                }
            }
            info.value += "Workshop #" + i + " " + counter + "=" + choices.join("+") + "\n";
        }
    }
}

function pageDidLoad() {
    "use strict";

    inputCode = CodeMirror.fromTextArea(document.getElementById('input'), {
        lineNumbers: true,
        mode: "csv",
        gutters: ["CodeMirror-lint-markers"],
        lint: true
    });
    inputCode.on("change", function() {
        localStorage.input = LZString.compressToUTF16(inputCode.getValue());
    });
    var compressed = localStorage.input;
    if (compressed !== undefined) {
        inputCode.setValue(LZString.decompressFromUTF16(compressed));
    }

    outputCode = CodeMirror.fromTextArea(document.getElementById('output'), {
        lineNumbers: true,
        mode: "csv",
        readOnly: true
    });
}
