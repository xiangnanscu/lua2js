import luaparse from "luaparse";
import prettier from "prettier/standalone";
import parserBabel from "prettier/parser-babel";

// let Sql = class {
//   static a = 1;
//   foo(n) {
//     this.n = n;
//     return "instance method";
//   }
//   static bar(n) {
//     this.n = n;
//     return "class method";
//   }
// };
// console.log(Sql.bar(1), Sql.n);
// let s = new Sql()
// console.log(s.foo(100), s.n);



// "base": {
//             "type": "MemberExpression",
//             "indexer": ".",
//             "identifier": {
//               "type": "Identifier",
//               "name": "format"
//             },
//             "base": {
//               "type": "Identifier",
//               "name": "string"
//             }
// }
const IdentifierMap = {
  extends: "_extends",
  class: "_class",
  default: "_js_default",
  debugger: "_debugger",
};
const binaryOpMap = {
  "..": "+",
  and: "&&",
  or: "||",
  "==": "===",
  "~=": "!==",
};

function isErrorCall(ast) {
  return ast.base?.type === "Identifier" && ast.base?.name == "error";
}
function luaError2JsThrow(ast) {
  return `throw new Error(${ast2js(ast.arguments[0])})`;
}
function isStringFormatCall(ast) {
  return (
    ((ast.base?.type === "Identifier" && ast.base?.name === "string_format") ||
      (ast.base?.type === "MemberExpression" &&
        ast.base?.identifier?.name === "format" &&
        ast.base?.base?.name === "string")) &&
    ast.arguments.length > 1 &&
    ast.arguments[0].type === "StringLiteral" &&
    ast.arguments[0].raw.includes("%s")
  );
}
function traverseAst(ast, callback) {
  if (ast instanceof Array) {
    for (let i = 0; i < ast.length; i++) {
      traverseAst(ast[i], callback);
    }
  } else if (ast instanceof Object) {
    if (ast.type !== undefined) {
      callback(ast);
    }
    for (let key in ast) {
      if (key !== "type") {
        traverseAst(ast[key], callback);
      }
    }
  } else {
  }
}
// {
//       "type": "AssignmentStatement",
//       "variables": [
//         {
//           "type": "IndexExpression",
//           "base": {
//             "type": "Identifier",
//             "name": "t"
//           },
//           "index": {
//             "type": "BinaryExpression",
//             "operator": "+",
//             "left": {
//               "type": "UnaryExpression",
//               "operator": "#",
//               "argument": {
//                 "type": "Identifier",
//                 "name": "t"
//               }
//             },
//             "right": {
//               "type": "NumericLiteral",
//               "value": 1,
//               "raw": "1"
//             }
//           }
//         }
//       ],
//       "init": [
//         {
//           "type": "Identifier",
//           "name": "b"
//         }
//       ]
//     }
function isIndexPlusOne(left, right, name) {
  return (
    left?.type === "UnaryExpression" &&
    left?.operator === "#" &&
    left?.argument?.name === name &&
    right?.type === "NumericLiteral" &&
    right?.value === 1
  );
}
function isTableInsert(ast) {
  if (ast.type !== "AssignmentStatement") {
    return;
  }
  if (ast.variables?.length !== 1 || ast.variables[0]?.type !== "IndexExpression") {
    return;
  }
  let index = ast.variables[0]?.index;
  if (!index) {
    return;
  }
  if (index.type !== "BinaryExpression" || index.operator !== "+") {
    return;
  }
  let basename = ast.variables[0]?.base?.name;
  if (!basename) {
    return;
  }
  return isIndexPlusOne(index.left, index.right, basename) || isIndexPlusOne(index.right, index.left, basename);
}
function formatLuaStringLiteral(s) {
  if (s[0] == "[") {
    let cut = s.indexOf("[", 1) + 1;
    let start_cut = s[cut] == "\n" ? cut + 1 : cut;
    return s.slice(start_cut, -cut);
  } else {
    return s.slice(1, -1);
  }
}
function luaLiteral2Js(s) {
  let c = s[0];
  s = formatLuaStringLiteral(s);
  if (c == "[") {
    return "`" + s.replace("`", "\\`") + "`";
  } else {
    return c + s + c;
  }
}
function luaFormat2JsTemplate(ast) {
  let s = formatLuaStringLiteral(ast.arguments[0].raw);
  let status = 0;
  let res = [];
  let j = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "%") {
      if (status === 0) {
        status = 1;
      } else if (status === 1) {
        status = 0;
        res.push(c);
      }
    } else if (c === "s" && status === 1) {
      j = j + 1;
      res.push("${" + ast2js(ast.arguments[j]) + "}");
      status = 0;
    } else if (c === "`") {
      res.push("\\" + c);
    } else {
      res.push(c);
    }
  }
  return "`" + res.join("") + "`";
}
function selfToThis(ast) {
  if (ast.type === "Identifier" && ast.name === "self") {
    ast.name = "this";
  }
}
function clsToThis(ast) {
  if (ast.type === "Identifier" && ast.name === "cls") {
    ast.name = "this";
  }
}
function smartPack(args) {
  switch (args.length) {
    case 0:
      return "";
    case 1:
      if (args[0].type === "VarargLiteral") {
        return "[...varargs]";
      } else {
        return ast2js(args[0]);
      }
    default:
      return `[${ast2js(args, ", ")}]`;
  }
}
function tagVarargAsSpread(args) {
  if (args.length === 0) {
    return args;
  }
  let last = args[args.length - 1];
  if (last.type === "VarargLiteral") {
    last.asSpread = true;
  }
  return args;
}
// {
//           "type": "CallExpression",
//           "base": {
//             "type": "Identifier",
//             "name": "select"
//           },
//           "arguments": [
//             {
//               "type": "StringLiteral",
//               "value": null,
//               "raw": "\"#\""
//             },
//             {
//               "type": "VarargLiteral",
//               "value": "...",
//               "raw": "..."
//             }
//           ]
//         }
function isSelectLength(node) {
  return (
    node.base?.name == "select" &&
    node.arguments.length == 2 &&
    node.arguments[0]?.raw?.slice(1, -1) == "#" &&
    node.arguments[1]?.type == "VarargLiteral"
  );
}
// {
//           "type": "CallExpression",
//           "base": {
//             "type": "Identifier",
//             "name": "select"
//           },
//           "arguments": [
//             {
//               "type": "NumericLiteral",
//               "value": 1,
//               "raw": "1"
//             },
//             {
//               "type": "VarargLiteral",
//               "value": "...",
//               "raw": "..."
//             }
//           ]
//         }
function isSelectNumber(node) {
  return (
    node.base?.name == "select" &&
    node.arguments.length == 2 &&
    !(node.arguments[0]?.raw?.slice(1, -1) == "#") &&
    node.arguments[1]?.type == "VarargLiteral"
  );
}
function ast2js(ast, joiner) {
  try {
    if (ast instanceof Array) {
      return ast.map(ast2js).join(joiner || ";\n");
    }
    switch (ast.type) {
      case "Chunk":
        ast.body.forEach((e) => {
          if (e.type == "ReturnStatement") {
            e.asExport = true;
          }
        });
        return ast2js(ast.body);
      case "Identifier":
        return IdentifierMap[ast.name] || ast.name;
      case "BreakStatement":
        return "break";
      case "DoStatement":
        return `{${ast2js(ast.body)}}`;
      case "AssignmentStatement":
      case "LocalStatement":
        if (isTableInsert(ast)) {
          return `${ast2js(ast.variables[0].base)}.push(${ast2js(ast.init)})`;
        }
        let scopePrefix = ast.type === "LocalStatement" ? "let " : "";
        switch (ast.init.length) {
          case 0:
            return `${scopePrefix}${ast2js(ast.variables, ", ")}`;
          case 1:
            return `${scopePrefix}${smartPack(ast.variables)} = ${ast2js(ast.init[0])}`;
          default:
            tagVarargAsSpread(ast.init);
            return `${scopePrefix}${smartPack(ast.variables)} = ${smartPack(ast.init)}`;
        }
      case "UnaryExpression":
        let exp = ast2js(ast.argument);
        switch (ast.operator) {
          case "not":
            return `!${exp}`;
          case "#":
            return `(${exp}).length`;
          default:
            return `${ast.operator}${exp}`;
        }
      case "BinaryExpression":
        return `(${ast2js(ast.left)} ${binaryOpMap[ast.operator] || ast.operator} ${ast2js(ast.right)})`;
      case "BooleanLiteral":
        return ast.raw;
      case "NumericLiteral":
        return ast.value;
      case "StringLiteral":
        return luaLiteral2Js(ast.raw);
      case "NilLiteral":
        return "undefined";
      case "VarargLiteral":
        return ast.asSpread ? "...varargs" : ast.asArray ? "[...varargs]" : "varargs[0]";
      case "LogicalExpression":
        return `(${ast2js(ast.left)} ${binaryOpMap[ast.operator] || ast.operator} ${ast2js(ast.right)})`;
      case "TableConstructorExpression":
        if (ast.isClassMode) {
          for (const field of ast.fields) {
            if (field.type === "TableKeyString") {
              field.isClassMode = true;
              field.value.isClassMode = true;
            }
          }
          return `{${ast2js(ast.fields, "\n")}}`;
        } else {
          let is_pure_array = ast.fields.length > 0 && ast.fields.every((e) => e.type == "TableValue");
          if (is_pure_array) {
            tagVarargAsSpread(ast.fields.map((e) => e.value));
            return `[${ast2js(ast.fields, ", ")}]`;
          } else {
            return `{${ast2js(ast.fields, ", ")}}`;
          }
        }
      case "TableKeyString":
        if (ast.isClassMode) {
          if (ast.value.type == "FunctionDeclaration") {
            ast.value.identifier = ast.key.name;
            return `${ast2js(ast.value)}`;
          } else {
            return `static ${ast2js(ast.key)} = ${ast2js(ast.value)}`;
          }
        } else {
          return `${ast2js(ast.key)}: ${ast2js(ast.value)}`;
        }
      case "TableKey":
        return `[${ast2js(ast.key)}]: ${ast2js(ast.value)}`;
      case "TableValue":
        return ast2js(ast.value);
      case "IndexExpression":
        return `${ast2js(ast.base)}[${ast2js(ast.index)}]`;
      case "IfStatement":
        return ast.clauses.map(ast2js).join("\n");
      case "IfClause":
        return `if (${ast2js(ast.condition)}) {${ast2js(ast.body)}}`;
      case "ElseClause":
        return `else {${ast.body.map(ast2js).join(";")}}`;
      case "ElseifClause":
        return `else if (${ast2js(ast.condition)}) {${ast2js(ast.body)}}`;
      case "FunctionDeclaration":
        tagVarargAsSpread(ast.parameters);
        if (ast.isClassMode) {
          let firstParamsName = ast.parameters[0]?.name;
          switch (firstParamsName) {
            case "self":
              traverseAst(ast.body, selfToThis);
              return `${ast.identifier}(${ast2js(ast.parameters.slice(1), ", ")}) {${ast2js(ast.body)}}`;
            case "cls":
              traverseAst(ast.body, clsToThis);
              return `static ${ast.identifier}(${ast2js(ast.parameters.slice(1), ", ")}) {${ast2js(ast.body)}}`;
            default:
            return `${ast.identifier}(${ast2js(ast.parameters, ", ")}) {${ast2js(ast.body)}}`;
          }
        } else {
          if (
            ast.identifier?.type == "MemberExpression" &&
            ast.identifier?.indexer == "." &&
            ast.parameters[0]?.name == "self"
          ) {
            ast.parameters = ast.parameters.slice(1);
            traverseAst(ast.body, selfToThis);
          } else if (ast.identifier?.type == "MemberExpression" && ast.identifier?.indexer == ":") {
            traverseAst(ast.body, selfToThis);
          }
          let main = `(${ast.parameters.map(ast2js).join(", ")}){${ast2js(ast.body)}}`;
          if (ast.identifier == null) {
            return `function ${main}`;
          } else {
            let fn_name = ast2js(ast.identifier);
            if (ast.identifier?.type == "MemberExpression") {
              return `${fn_name} = function ${main}`;
            } else {
              return `${ast.isLocal ? "let " : ""} ${fn_name} = function ${fn_name}${main}`;
            }
          }
        }
      case "MemberExpression":
        // let hide_self = ast.indexer == ":";
        return `${ast2js(ast.base)}.${ast2js(ast.identifier)}`;
      case "ReturnStatement":
        tagVarargAsSpread(ast.arguments);
        if (ast.asExport) {
          return `export default ${smartPack(ast.arguments)}`;
        } else {
          return `return ${smartPack(ast.arguments)}`;
        }

      case "CallStatement":
        return ast2js(ast.expression);
      case "CallExpression":
        if (isSelectLength(ast)) {
          return `varargs.length`;
        } else if (isSelectNumber(ast)) {
          return `varargs[${ast2js(ast.arguments[0])}]`;
        } else if (isStringFormatCall(ast)) {
          return luaFormat2JsTemplate(ast);
        } else if (isErrorCall(ast)) {
          return luaError2JsThrow(ast);
        } else if (ast.arguments[0]?.name == "this") {
          tagVarargAsSpread(ast.arguments);
          let rest = ast.arguments.slice(1);
          return `${ast2js(ast.base)}.call(this${rest.length > 0 ? ", " : ""}${rest.map(ast2js).join(", ")})`;
        } else {
          tagVarargAsSpread(ast.arguments);
          return `${ast2js(ast.base)}(${ast.arguments.map(ast2js).join(", ")})`;
        }
      case "TableCallExpression":
        if (ast.base.type == "Identifier" && ast.base.name == "class") {
          ast.arguments.isClassMode = true;
          return `class ${ast2js(ast.arguments)}`;
        } else {
          return `${ast2js(ast.base)}(${ast2js(ast.arguments)})`;
        }

      case "StringCallExpression":
        return `${ast2js(ast.base)}(${ast2js(ast.argument)})`;
      case "ForNumericStatement":
        let v = ast2js(ast.variable);
        let step = ast.step == null ? 1 : ast2js(ast.step);
        let start = ast2js(ast.start);
        let compare_op;
        if (start === 1) {
          start = 0;
          compare_op = step < 0 ? ">" : "<";
        } else {
          compare_op = step < 0 ? ">=" : "<=";
        }
        return `for (let ${v}=${start}; ${v} ${compare_op} ${ast2js(ast.end)}; ${v}=${v}+${step}) {${ast2js(
          ast.body
        )}}`;
      case "ForGenericStatement":
        let iter;
        if (ast.iterators.length == 1) {
          let iter_name = ast.iterators[0].base.name;
          if (iter_name == "ipairs") {
            iter = `${ast2js(ast.iterators[0].arguments)}.entries()`;
          } else if (iter_name == "pairs") {
            iter = `Object.entries(${ast2js(ast.iterators[0].arguments)})`;
          } else {
            iter = ast.iterators.map(ast2js);
          }
        } else {
          iter = ast.iterators.map(ast2js);
        }
        return `for (let ${smartPack(ast.variables)} of ${iter}) {${ast2js(ast.body)}}`;
      case "WhileStatement":
        return `while (${ast2js(ast.condition)}) {${ast2js(ast.body)}}`;
      default:
        throw new Error(`Unsupported AST node type: ${ast.type}`);
    }
  } catch (error) {
    return `[${error.message}]`;
  }
}
function lua2ast(lua_code) {
  try {
    return luaparse.parse(lua_code);
  } catch (error) {
    return { error: error.message };
  }
}

function lua2js(lua_code) {
  let js = "";
  try {
    js = ast2js(lua2ast(lua_code));
    return prettier.format(js, { parser: "babel", rules: { "no-debugger": "off" }, plugins: [parserBabel] });
  } catch (error) {
    return `/*\n${error}\n*/\n${js}`;
  }
}

export { lua2ast, lua2js, ast2js };
