#include "ppapi/cpp/instance.h"
#include "ppapi/cpp/module.h"
#include "ppapi/cpp/var.h"
#include "ppapi/cpp/var_array.h"
#include "ppapi/cpp/var_dictionary.h"

#include <algorithm>
#include <random>
#include <vector>

using namespace std;

inline std::mt19937_64 &global_random_engine() {
    static std::random_device rdev;
    static std::mt19937_64 eng(rdev());
    return eng;
}

inline double canonical() {
    return std::generate_canonical<double, std::numeric_limits<double>::digits>(
        global_random_engine());
}

bool is_not_null(int x) {
    return x != 0;
}

class MyInstance : public pp::Instance {
private:
size_t g_random_numbers_counter = 0;
size_t g_random_numbers_size = 64 * 1024;
vector<double> g_random_numbers;

public:
explicit MyInstance(PP_Instance instance) : pp::Instance(instance)
{
    canonical_fast_initialize();
}
virtual ~MyInstance() {
}

void canonical_fast_initialize() {
    g_random_numbers_counter = 0;
    g_random_numbers.resize(g_random_numbers_size);
    for (size_t i = 0; i < g_random_numbers_size; ++i)
        g_random_numbers[i] = canonical();
}

inline double canonical_fast() {
    return g_random_numbers[g_random_numbers_counter++ % g_random_numbers_size];
}

size_t min_pos(const vector<double>& xs) {
    size_t k = 0;
    double min = xs[0];
    for (size_t i = 1; i < xs.size(); ++i) {
        if (xs[i] < min) {
            min = xs[i];
            k = i;
        }
    }
    return k;
}

bool count(const vector<int>& vmin, const vector<int>& vmax, vector<int> &x, const vector<vector<double>> &values) {
    for (size_t j = 0; j < vmin.size(); ++j) {
        x[j] = 0;
    }

    // occupation of each workshop
    for (size_t i = 0; i < values.size(); ++i) {
        size_t k = min_pos(values[i]);
        x[k]++;
    }

    bool ok = true;
    for (size_t i = 0; i < x.size(); ++i) {
        if (x[i] < vmin[i]) {
            x[i] -= vmin[i];      // negative value for a lack
            ok = false;
        } else if (x[i] > vmax[i]) {
            x[i] -= vmax[i];      // positive value for an overage
            ok = false;
        } else {
            x[i] = 0;             // null value if in range
        }
    }

    return ok;
}

void shuffle(const vector<int>& vmin, const vector<int>& vmax, vector<vector<double>> values, vector<int> &results) {
    for (size_t i = 0; i < values.size(); ++i) {
        for (size_t j = 0; j < values[i].size(); ++j) {
            double r = 2.0 * canonical() - 1.0;
            values[i][j] += 0.4 * r * r * r;
        }
    }
    vector<int> cnt(vmin.size(), 0);

    while (!count(vmin, vmax, cnt, values)) {

        for (size_t i = 0; i < values.size(); ++i) {
            for (size_t j = 0; j < vmin.size(); ++j) {
                values[i][j] += 2e-4 * canonical_fast() * cnt[j] * cnt[j] * cnt[j];
            }
        }
    }

    results.resize(values.size());
    for (size_t i = 0; i < values.size(); ++i)
        results[i] = min_pos(values[i]);
}

int action(const vector<vector<double>>& wishes, const vector<int>& results) {
    int score = 0;
    for (size_t i = 0; i < wishes.size(); ++i) {
        score += wishes[i][results[i]] * wishes[i][results[i]];
    }
    return score;
}

vector<int> search_solution(vector<int> vmin, vector<int> vmax, vector<vector<double>> wishes) {
    int best_score = -1;
    vector<int> best_results;
    vector<int> results;

    for (int i = 0; i < 100; ++i) {
        shuffle(vmin, vmax, wishes, results);

        int score = action(wishes, results);

        if (score < best_score || best_score == -1) {
            best_score = score;
            best_results = results;
        }

        if (g_random_numbers_counter > 8 * g_random_numbers_size)
            canonical_fast_initialize();
    }

    return best_results;
}

pp::VarArray search(const pp::Var& var_message) {
    const pp::VarDictionary& dic = static_cast<const pp::VarDictionary&>(var_message);

    pp::VarArray vmin = static_cast<pp::VarArray>(dic.Get("vmin"));
    pp::VarArray vmax = static_cast<pp::VarArray>(dic.Get("vmax"));
    pp::VarArray wishes = static_cast<pp::VarArray>(dic.Get("wishes"));

    vector<int> vmin_v(vmin.GetLength());
    vector<int> vmax_v(vmin.GetLength());
    vector<vector<double>> wishes_v(wishes.GetLength());

    for (size_t i = 0; i < vmin_v.size(); ++i) {
        vmin_v[i] = vmin.Get(i).AsInt();
    }
    for (size_t i = 0; i < vmax_v.size(); ++i) {
        vmax_v[i] = vmax.Get(i).AsInt();
    }

    for (size_t i = 0; i < wishes_v.size(); ++i) {
        pp::VarArray row = static_cast<pp::VarArray>(wishes.Get(i));
        vector<double> row_v(row.GetLength());
        for (size_t j = 0; j < row_v.size(); ++j) {
            row_v[j] = row.Get(j).AsInt();
        }
        wishes_v[i] = row_v;
    }

    vector<int> result_v = search_solution(vmin_v, vmax_v, wishes_v);
    pp::VarArray result;
    result.SetLength(result_v.size());
    for (size_t i = 0; i < result_v.size(); ++i) {
        result.Set(i, result_v[i]);
    }
    return result;
}

virtual void HandleMessage(const pp::Var& var_message) {
    PostMessage(search(var_message));
}
};

class MyModule : public pp::Module {
public:
MyModule() : pp::Module() {
}
virtual ~MyModule() {
}

virtual pp::Instance* CreateInstance(PP_Instance instance) {
    return new MyInstance(instance);
}
};

namespace pp {
Module* CreateModule() {
    return new MyModule();
}
}  // namespace pp
