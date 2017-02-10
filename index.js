function parse(text) {
    errors = [];

    ch = text.length === 0 ? null : text[0];
    k = 0;
    l = 0;
    c = 0;

    vmin = null;
    vmax = null;
    wishes = [];

    vmin_sum = 0;
    vmax_sum = 0;

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

        row = [];
        x = eat_number();
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
                to: CodeMirror.Pos(l, c),
                message: "All the lines must contain the same amount of values"
            });
            return;
        }
        if (vmin === null) {
            vmin = row;
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
                        to: CodeMirror.Pos(l, c),
                        message: "vmax must be greater or equal than vmin"
                    });
                }
            }
        } else {
            wishes.push(row);
            if (wishes.length > vmax_sum) {
                errors.push({
                    from: CodeMirror.Pos(l, 0),
                    to: CodeMirror.Pos(l, c),
                    message: "vmax is too small or there is too much entries"
                });
            }
            tmp = row.slice();
            tmp.sort();
            for (i = 0; i < tmp.length; ++i) {
                if (tmp[i] > i) {
                    errors.push({
                        from: CodeMirror.Pos(l, 0),
                        to: CodeMirror.Pos(l, c),
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
        entry = ch;
        eat();
        while (is_digit(ch)) {
            entry += ch;
            eat();
        }
        num = Number(entry);
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

    if (wishes.length < vmin_sum) {
        errors.push({
            from: CodeMirror.Pos(0, 0),
            to: CodeMirror.Pos(l, c),
            message: "vmin is too high for the amount of entries"
        });
    }

    res = {
        'vmin': vmin,
        'vmax': vmax,
        'wishes': wishes
    };

    return [res, errors];
}

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

function action(wishes, results) {
    score = 0;
    for (i = 0; i < wishes.length; ++i) {
        score += Math.pow(wishes[i][results[i]], 2);
    }
    return score;
}

inputCode = null;
outputCode = null;

function button_pressed() {
    text = inputCode.getValue();
    out = parse(text);
    if (out[1].length === 0) {
        vmin = out[0].vmin;
        vmax = out[0].vmax;
        wishes = out[0].wishes;

        vmin_tot = 0;
        for (i = 0; i < vmin.length; ++i) {
            vmin_tot += vmin[i];
        }
        vmax_tot = 0;
        for (i = 0; i < vmax.length; ++i) {
            vmax_tot += vmax[i];
        }

        cost = [];
        x = Math.pow(vmin.length, 2);

        for (i = 0; i < wishes.length; ++i) {
            row = [];
            for (j = 0; j < vmin.length; ++j) {
                c = Math.pow(wishes[i][j], 2);
                for (k = 0; k < vmin[j]; ++k) {
                    row.push(c);
                }
                for (k = vmin[j]; k < vmax[j]; ++k) {
                    row.push(x + c);
                }
            }
            cost.push(row);
        }

        // append virtual studdent at the end
        for (i = wishes.length; i < vmax_tot; ++i) {
            row = [];
            for (j = 0; j < vmin.length; ++j) {
                for (k = 0; k < vmin[j]; ++k) {
                    row.push(x);
                }
                for (k = vmin[j]; k < vmax[j]; ++k) {
                    row.push(0);
                }
            }
            cost.push(row);
        }

        var h = new Hungarian(cost);
        var result = h.execute();

        result.length = wishes.length;
        for (i = 0; i < result.length; ++i) {
            for (j = 0; j < vmax.length; ++j) {
                if (result[i] >= vmax[j]) {
                    result[i] -= vmax[j];
                } else {
                    result[i] = j;
                    break;
                }
            }
        }

        score = action(wishes, result);

        text = "# attribution,score\n";
        for (i = 0; i < result.length; ++i) {
            text += result[i] + "," + wishes[i][result[i]] + "\n";
        }
        outputCode.setValue(text);

        var info = document.getElementById('info');
        info.value = "";

        info.value += "Total score of " + score + ".\n\n";

        choices = [];
        for (i = 0; i < vmin.length; ++i) {
            choices.push(0);
        }
        for (i = 0; i < result.length; ++i) {
            choices[wishes[i][result[i]]]++;
        }
        info.value += "Satisfaction distribution : " + choices.join(" ") + "\n\n";

        v = [];
        for (i = 0; i < vmin.length; ++i) {
            v.push(0);
        }
        for (i = 0; i < result.length; ++i) {
            v[result[i]]++;
        }

        text = "";
        for (i = 0; i < vmin.length; ++i) {
            choices = [];
            for (j = 0; j < vmin.length; ++j) {
                choices.push(0);
            }

            for (j = 0; j < result.length; ++j) {
                if (result[j] === i) {
                    choices[wishes[j][i]]++;
                }
            }
            text += "workshop " + i + ": " + v[i] + " : " + choices.join(" ") + "\n";
        }
        info.value += text;
    }
}

function pageDidLoad() {
    inputCode = CodeMirror.fromTextArea(document.getElementById('input'), {
        lineNumbers: true,
        mode: "csv",
        gutters: ["CodeMirror-lint-markers"],
        lint: true
    });
    outputCode = CodeMirror.fromTextArea(document.getElementById('output'), {
        lineNumbers: true,
        mode: "csv",
        readOnly: true
    });
}
