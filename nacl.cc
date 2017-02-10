#include "ppapi/cpp/instance.h"
#include "ppapi/cpp/module.h"
#include "ppapi/cpp/var.h"
#include "ppapi/cpp/var_array.h"
#include "ppapi/cpp/var_dictionary.h"

#include "hung.c"

using namespace std;

class MyInstance : public pp::Instance {
public:
explicit MyInstance(PP_Instance instance) : pp::Instance(instance)
{
}
virtual ~MyInstance() {
}


pp::VarArray search(const pp::Var& var_message) {
    pp::VarArray message = static_cast<pp::VarArray>(var_message);
    size_t n = message.GetLength();
    cell** cost = (cell**)malloc(n * sizeof(cell*));

    for (size_t i = 0; i < n; ++i) {
        cost[i] = (cell*)malloc(n * sizeof(cell));

        pp::VarArray row_message = static_cast<pp::VarArray>(message.Get(i));
        for (size_t j = 0; j < n; ++j) {
            cost[i][j] = row_message.Get(j).AsInt();
        }
    }

    ssize_t** ass = kuhn_match(cost, n, n);

    pp::VarArray result;
    result.SetLength(n);
    for (size_t i = 0; i < n; ++i) {
        result.Set(ass[i][0], ass[i][1]);
    }

    for (size_t i = 0; i < n; ++i) {
        free(ass[i]);
        free(cost[i]);
    }
    free(ass);
    free(cost);

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
