import luaparse from "luaparse";
import prettier from "prettier/standalone.js";
import parserBabel from "prettier/parser-babel.js";

// TODO: for _, v in ipairs(t) => for v of t , NOT for [_, v] of t.entries()
// this.foo[this.foo+1]=x => this.foo.push(x)
// a..'1'..b => a + '1' + b (no parens)
const defaultOptions = {
  printToConsoleLog: true,
  tryUseOfLoop: true,
  indexMinusOne: true,
  returnNilToThrow: true,
  errorToThrow: true,
  tostring: true,
  dict: true,
  list: true,
  unpack: true,
  tonumber: true,
  class: true,
  selfToThis: true,
  clsToThis: true,
  typeToTypeof: true,
  stringFormat: true,
  tableConcat: true,
  tableInsert: true,
  camelStyle: false,
};
function canBeArraowFunction(ast) {
  return !ast.identifier && ast.body.length === 1 && ast.body[0].type == "ReturnStatement";
}
function joinUnderscore(length) {
  return Array.from({ length }, () => "_").join("");
}
function toCamel(s) {
  let status = -1;
  const res = [];
  let longUnderscoreCnt = 0;
  for (const c of s) {
    if (c == "_") {
      if (status == -1) {
        res.push(c);
      } else if (status == 0) {
        status = 1;
      } else if (status == 1 || status == 2) {
        status = 2;
        longUnderscoreCnt += 1;
      }
    } else if (status == -1) {
      //第一个非_字符
      res.push(c);
      status = 0;
    } else if (status == 0) {
      res.push(c);
    } else if (status == 1) {
      if (/[A-Z]/.test(c)) {
        res.push("_" + c);
      } else {
        res.push(c.toUpperCase());
      }
      status = 0;
    } else if (status == 2) {
      res.push(joinUnderscore(longUnderscoreCnt + 1) + c);
      longUnderscoreCnt = 0;
      status = 0;
    }
  }
  if (status == 1) {
    res.push("_");
  } else if (status == 2) {
    res.push(joinUnderscore(longUnderscoreCnt + 1));
  }
  return res.join("");
}

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
  init: "constructor",
  constructor: "_constructor",
  extends: "_extends",
  class: "_class",
  super: "_super",
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
function traverseAst(ast, callback) {
  if (ast instanceof Array) {
    for (let i = 0; i < ast.length; i++) {
      traverseAst(ast[i], callback);
    }
  } else if (ast instanceof Object) {
    if (ast.type !== undefined) {
      callback(ast);
    }
    for (const key in ast) {
      if (key !== "type") {
        traverseAst(ast[key], callback);
      }
    }
  }
}
function insertPrototypeNode(base) {
  return {
    type: "MemberExpression",
    indexer: ".",
    identifier: {
      type: "Identifier",
      name: "prototype",
    },
    base: base,
  };
}
function isClassExtends(ast) {
  return (
    ast.base.type == "Identifier" &&
    ast.base.name == "class" &&
    ast.arguments instanceof Array &&
    ast.arguments.length == 2
  );
}
function isErrorCall(ast) {
  return ast.base?.type === "Identifier" && ast.base?.name == "error";
}

function isTostringCall(ast) {
  return ast.base?.type === "Identifier" && ast.base?.name == "tostring";
}

function isDictCall(ast) {
  return (
    (ast.base?.type === "Identifier" && ast.base?.name == "dict") ||
    (ast.base?.type === "MemberExpression" && ast.base?.identifier?.name === "dict" && ast.base?.base?.name === "utils")
  );
}

function isListCall(ast) {
  return (
    (ast.base?.type === "Identifier" && ast.base?.name == "list") ||
    (ast.base?.type === "MemberExpression" && ast.base?.identifier?.name === "list" && ast.base?.base?.name === "utils")
  );
}
function isUnpackCall(ast) {
  return ast.base?.type === "Identifier" && ast.base?.name == "unpack";
}

function isTonumberCall(ast) {
  return ast.base?.type === "Identifier" && ast.base?.name == "tonumber" && ast.arguments.length === 1;
}

function isPrintCall(ast) {
  return ast.base?.type === "Identifier" && ast.base?.name == "print";
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
function isTableInsertCall(ast) {
  return (
    ast.arguments?.length == 2 &&
    ((ast.base?.type === "Identifier" && ast.base?.name === "table_insert") ||
      (ast.base?.type === "MemberExpression" &&
        ast.base?.identifier?.name === "insert" &&
        ast.base?.base?.name === "table"))
  );
}
function isNumerOne(ast) {
  return ast.type == "NumericLiteral" && ast.value == 1;
}
function isTableInsertAtHeadCall(ast) {
  return (
    ast.arguments?.length == 3 &&
    isNumerOne(ast.arguments[1]) &&
    ((ast.base?.type === "Identifier" && ast.base?.name === "table_insert") ||
      (ast.base?.type === "MemberExpression" &&
        ast.base?.identifier?.name === "insert" &&
        ast.base?.base?.name === "table"))
  );
}

function isTableConcatCall(ast) {
  return (
    (ast.base?.type === "Identifier" && ast.base?.name === "table_concat") ||
    (ast.base?.type === "MemberExpression" &&
      ast.base?.identifier?.name === "concat" &&
      ast.base?.base?.name === "table")
  );
}

function isInstanceMethod(ast) {
  return (
    ast.type == "FunctionDeclaration" &&
    ast.identifier?.type == "MemberExpression" &&
    ast.parameters[0] &&
    ast.parameters[0].type == "Identifier" &&
    ast.parameters[0].name == "self"
  );
}
function isAssertCall(ast) {
  return ast.base?.type === "Identifier" && ast.base?.name === "assert";
}

function isTypeCall(ast) {
  return ast.base?.type === "Identifier" && ast.base?.name === "type";
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
  const index = ast.variables[0]?.index;
  if (!index) {
    return;
  }
  if (index.type !== "BinaryExpression" || index.operator !== "+") {
    return;
  }
  const basename = ast.variables[0]?.base?.name;
  if (!basename) {
    return;
  }
  return isIndexPlusOne(index.left, index.right, basename) || isIndexPlusOne(index.right, index.left, basename);
}
function getLuaStringToken(s) {
  if (s[0] == "[") {
    const cut = s.indexOf("[", 1) + 1;
    const start_cut = s[cut] == "\n" ? cut + 1 : cut;
    return s.slice(start_cut, -cut);
  } else {
    return s.slice(1, -1);
  }
}
function luaLiteral2Js(s) {
  const head = s[0];
  const res = getLuaStringToken(s);
  if (head == "[") {
    return "`" + res.replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("$", "\\$") + "`";
  } else {
    return head + res + head;
  }
}
function isReturnNilAndErr(ast) {
  return ast.arguments?.length == 2 && ast.arguments[0].type == "NilLiteral";
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

function tagVarargAsSpread(args) {
  if (args.length === 0) {
    return args;
  }
  const last = args[args.length - 1];
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

function isClassDeclare(ast) {
  return (
    ast.variables.length == 1 &&
    ast.init.length == 1 &&
    (ast.init[0].type == "TableCallExpression" || ast.init[0].type == "CallExpression") &&
    ast.init[0].base?.name == "class"
  );
}
function lua2ast(lua_code) {
  try {
    return luaparse.parse(lua_code);
  } catch (error) {
    return { error: error.message };
  }
}
function ast2js(ast, opts = {}) {
  opts = { ...defaultOptions, ...opts };
  function luaAssert2JsIfThrow(ast) {
    // tansform lua assert(bool, error) to js if (!bool) {throw new Error(error)}
    if (ast.arguments.length == 1) {
      return `if (!(${_ast2js(ast.arguments[0])})) {throw new Error("assertion failed!")}`;
    } else {
      return `if (!(${_ast2js(ast.arguments[0])})) {throw new Error(${_ast2js(ast.arguments[1])})}`;
    }
  }
  function luaFormat2JsTemplate(ast) {
    const s = getLuaStringToken(ast.arguments[0].raw);
    let status = 0;
    const res = [];
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
        res.push("${" + _ast2js(ast.arguments[j]) + "}");
        status = 0;
      } else if (c === "`") {
        res.push("\\" + c);
      } else {
        res.push(c);
      }
    }
    return "`" + res.join("") + "`";
  }
  function smartPack(args) {
    switch (args.length) {
      case 0:
        return "";
      case 1:
        if (args[0].type === "VarargLiteral") {
          return "[...varargs]";
        } else {
          return _ast2js(args[0]);
        }
      default:
        return `[${args.map(_ast2js).join(", ")}]`;
    }
  }
  function _ast2js(ast) {
    if (ast instanceof Array) {
      return ast.map(_ast2js).join(";\n");
    }
    switch (ast.type) {
      case "Chunk":
        ast.body.forEach((e) => {
          if (e.type == "ReturnStatement") {
            e.asExport = true;
          }
        });
        return _ast2js(ast.body);
      case "Identifier": {
        const s = IdentifierMap[ast.name] || ast.name;
        return opts.camelStyle ? toCamel(s) : s;
      }
      case "BreakStatement":
        return "break";
      case "DoStatement":
        return `{${_ast2js(ast.body)}}`;
      case "AssignmentStatement":
      case "LocalStatement": {
        if (isClassDeclare(ast)) {
          const s = ast.variables[0].name;
          ast.init[0].className = opts.camelStyle ? toCamel(s) : s;
          return _ast2js(ast.init[0]);
        }
        if (isTableInsert(ast)) {
          return `${_ast2js(ast.variables[0].base)}.push(${_ast2js(ast.init)})`;
        }
        const scopePrefix = ast.type === "LocalStatement" ? "let " : "";
        switch (ast.init.length) {
          case 0:
            return `${scopePrefix}${ast.variables.map(_ast2js).join(", ")}`;
          case 1:
            return `${scopePrefix}${smartPack(ast.variables)} = ${_ast2js(ast.init[0])}`;
          default:
            tagVarargAsSpread(ast.init);
            return `${scopePrefix}${smartPack(ast.variables)} = ${smartPack(ast.init)}`;
        }
      }
      case "UnaryExpression": {
        const exp = _ast2js(ast.argument);
        switch (ast.operator) {
          case "not":
            return `!${exp}`;
          case "#":
            return `(${exp}).length`;
          default:
            return `${ast.operator}${exp}`;
        }
      }
      case "BinaryExpression":
        ast.left.isBinaryExpressionMode = true;
        ast.right.isBinaryExpressionMode = true;
        return `(${_ast2js(ast.left)} ${binaryOpMap[ast.operator] || ast.operator} ${_ast2js(ast.right)})`;
      case "BooleanLiteral":
        return ast.raw;
      case "NumericLiteral":
        return ast.value;
      case "StringLiteral":
        if (ast.isBinaryExpressionMode && getLuaStringToken(ast.raw) === "table") {
          return '"object"';
        } else {
          return luaLiteral2Js(ast.raw);
        }
      case "NilLiteral":
        return "undefined";
      case "VarargLiteral":
        return ast.asSpread ? "...varargs" : ast.asArray ? "[...varargs]" : "varargs[0]";
      case "LogicalExpression":
        return `(${_ast2js(ast.left)} ${binaryOpMap[ast.operator] || ast.operator} ${_ast2js(ast.right)})`;
      case "TableConstructorExpression":
        if (ast.isClassMode) {
          for (const field of ast.fields) {
            if (field.type === "TableKeyString") {
              if (field.value.type !== "TableConstructorExpression") {
                field.isClassMode = true;
                field.value.isClassMode = true;
              } else {
                field.isClassMode = true;
              }
            }
          }
          return `{${ast.fields.map(_ast2js).join("\n")}}`;
        } else if (ast.fields.length === 0) {
          // try guess from later code whether contains t[#t+1] or table.concat(t)
          return "[]";
        } else {
          const is_pure_array = ast.fields.every((e) => e.type == "TableValue");
          if (is_pure_array) {
            tagVarargAsSpread(ast.fields.map((e) => e.value));
            return `[${ast.fields.map(_ast2js).join(", ")}]`;
          } else {
            return `{${ast.fields.map(_ast2js).join(", ")}}`;
          }
        }
      case "TableKeyString":
        if (ast.isClassMode) {
          if (ast.value.type == "FunctionDeclaration") {
            ast.value.identifier = {
              type: "Identifier",
              name: ast.key.name,
            };
            return `${_ast2js(ast.value)}`;
          } else {
            return `${_ast2js(ast.key)} = ${_ast2js(ast.value)}`;
          }
        } else {
          return `${_ast2js(ast.key)}: ${_ast2js(ast.value)}`;
        }
      case "TableKey":
        return `[${_ast2js(ast.key)}]: ${_ast2js(ast.value)}`;
      case "TableValue":
        return _ast2js(ast.value);
      case "IndexExpression":
        if (opts.indexMinusOne && ast.index?.type == "NumericLiteral" && ast.index.value >= 1) {
          ast.index.value = ast.index.value - 1;
          return `${_ast2js(ast.base)}[${_ast2js(ast.index)}]`;
        } else {
          return `${_ast2js(ast.base)}[${_ast2js(ast.index)}]`;
        }
      case "IfStatement":
        return ast.clauses.map(_ast2js).join("\n");
      case "IfClause":
        return `if (${_ast2js(ast.condition)}) {\n${_ast2js(ast.body)}\n}`;
      case "ElseClause":
        return `else {\n${ast.body.map(_ast2js).join(";\n")}\n}`;
      case "ElseifClause":
        return `else if (${_ast2js(ast.condition)}) {\n${_ast2js(ast.body)}\n}`;
      case "FunctionDeclaration":
        tagVarargAsSpread(ast.parameters);
        if (ast.isClassMode) {
          const firstParamsName = ast.parameters[0]?.name;
          if (firstParamsName === "self") {
            traverseAst(ast.body, selfToThis);
            return `${_ast2js(ast.identifier)}(${ast.parameters.slice(1).map(_ast2js).join(", ")}) {${_ast2js(
              ast.body
            )}}`;
          } else if (firstParamsName === "cls") {
            traverseAst(ast.body, clsToThis);
            return `static ${_ast2js(ast.identifier)}(${ast.parameters.slice(1).map(_ast2js).join(", ")}) {${_ast2js(
              ast.body
            )}}`;
          } else {
            return `${_ast2js(ast.identifier)}(${ast.parameters.map(_ast2js).join(", ")}) {${_ast2js(ast.body)}}`;
          }
        } else if (canBeArraowFunction(ast)) {
          return `(${ast.parameters.map(_ast2js).join(", ")}) => ${_ast2js(ast.body[0].arguments)}`;
        } else {
          if (
            opts.selfToThis &&
            ast.identifier?.type == "MemberExpression" &&
            ast.identifier?.indexer == "." &&
            ast.parameters[0]?.name == "self"
          ) {
            ast.identifier.base = insertPrototypeNode(ast.identifier.base);
            ast.parameters = ast.parameters.slice(1);
            traverseAst(ast.body, selfToThis);
          } else if (opts.selfToThis && ast.identifier?.type == "MemberExpression" && ast.identifier?.indexer == ":") {
            ast.identifier.base = insertPrototypeNode(ast.identifier.base);
            traverseAst(ast.body, selfToThis);
          } else if (
            opts.clsToThis &&
            ast.identifier?.type == "MemberExpression" &&
            ast.identifier?.indexer == "." &&
            ast.parameters[0]?.name == "cls"
          ) {
            ast.parameters = ast.parameters.slice(1);
            traverseAst(ast.body, clsToThis);
          }
          const main = `(${ast.parameters.map(_ast2js).join(", ")}){\n${_ast2js(ast.body)}}`;
          if (ast.identifier == null) {
            return `function ${main}`;
          } else {
            const fnName = _ast2js(ast.identifier);
            if (ast.identifier?.type == "MemberExpression") {
              return `${fnName} = function ${main}`;
            } else {
              // return `${ast.isLocal ? "let " : ""} ${fn_name} = function ${fn_name}${main}`;
              return `function ${fnName}${main}`;
            }
          }
        }
      case "MemberExpression":
        // let hide_self = ast.indexer == ":";
        return `${_ast2js(ast.base)}.${_ast2js(ast.identifier)}`;
      case "ReturnStatement":
        if (opts.returnNilToThrow && isReturnNilAndErr(ast)) {
          return `throw new Error(${_ast2js(ast.arguments[1])})`;
        }
        tagVarargAsSpread(ast.arguments);
        if (ast.asExport) {
          return `export default ${smartPack(ast.arguments)}`;
        } else {
          return `return ${smartPack(ast.arguments)};`;
        }

      case "CallStatement":
        return _ast2js(ast.expression);
      case "CallExpression":
        if (opts.class && ast.base.type == "Identifier" && ast.base.name == "class" && ast.className) {
          ast.arguments[0].isClassMode = true;
          const extendsToken = ast.arguments.length == 1 ? "" : "extends " + _ast2js(ast.arguments[1]);
          return `class ${ast.className} ${extendsToken} ${_ast2js(ast.arguments[0])}`;
        } else if (opts.class && isClassExtends(ast)) {
          const [cls, pcls] = ast.arguments;
          cls.isClassMode = true;
          return `class ${_ast2js(cls)} extends ${_ast2js(pcls)}`;
        } else if (isSelectLength(ast)) {
          return `varargs.length`;
        } else if (isSelectNumber(ast)) {
          return `varargs[${_ast2js(ast.arguments[0])}]`;
        } else if (opts.stringFormat && isStringFormatCall(ast)) {
          return luaFormat2JsTemplate(ast);
        } else if (opts.errorToThrow && isErrorCall(ast)) {
          return `throw new Error(${_ast2js(ast.arguments[0])})`;
        } else if (opts.tostring && isTostringCall(ast)) {
          return `String(${_ast2js(ast.arguments[0])})`;
        } else if (opts.dict && isDictCall(ast)) {
          return `{${ast.arguments.map((e) => `...(${_ast2js(e)})`).join(", ")}}`;
        } else if (opts.list && isListCall(ast)) {
          return `[${ast.arguments.map((e) => `...(${_ast2js(e)})`).join(", ")}]`;
        } else if (opts.unpack && isUnpackCall(ast)) {
          return `...${_ast2js(ast.arguments[0])}`;
        } else if (opts.printToConsoleLog && isPrintCall(ast)) {
          return `console.log(${ast.arguments.map(_ast2js).join(", ")})`;
        } else if (opts.tonumber && isTonumberCall(ast)) {
          return `Number(${_ast2js(ast.arguments[0])})`;
        } else if (opts.tableInsert && isTableInsertCall(ast)) {
          // tansform lua table.insert(t, 1) / table_insert(t, 1) to js t.push(1)
          const [base, element] = ast.arguments;
          return `${_ast2js(base)}.push(${_ast2js(element)})`;
        } else if (opts.tableInsert && isTableInsertAtHeadCall(ast)) {
          const [base, index, element] = ast.arguments;
          return `${_ast2js(base)}.unshift(${_ast2js(element)})`;
        } else if (opts.tableConcat && isTableConcatCall(ast)) {
          return `${_ast2js(ast.arguments[0])}.join(${ast.arguments[1] ? _ast2js(ast.arguments[1]) : '""'})`;
          // } else if (isAssertCall(ast)) {
          //   return luaAssert2JsIfThrow(ast);
        } else if (opts.typeToTypeof && isTypeCall(ast)) {
          return `typeof(${_ast2js(ast.arguments[0])})`;
        } else if (ast.arguments[0]?.name == "this") {
          // lua: Class.foo(self, ...)
          tagVarargAsSpread(ast.arguments);
          const rest = ast.arguments.slice(1);
          if (ast.base.base) {
            ast.base.base = {
              type: "MemberExpression",
              indexer: ".",
              identifier: {
                type: "Identifier",
                name: "prototype",
              },
              base: ast.base.base,
            };
          }
          return `${_ast2js(ast.base)}.call(this${rest.length > 0 ? ", " : ""}${rest.map(_ast2js).join(", ")})`;
        } else {
          tagVarargAsSpread(ast.arguments);
          return `${_ast2js(ast.base)}(${ast.arguments.map(_ast2js).join(", ")})`;
        }
      case "TableCallExpression":
        if (opts.class && ast.base.type == "Identifier" && ast.base.name == "class") {
          ast.arguments.isClassMode = true;
          if (ast.className) {
            return `class ${ast.className} ${_ast2js(ast.arguments)}`;
          } else {
            return `class ${_ast2js(ast.arguments)}`;
          }
        } else {
          return `${_ast2js(ast.base)}(${_ast2js(ast.arguments)})`;
        }

      case "StringCallExpression":
        return `${_ast2js(ast.base)}(${_ast2js(ast.argument)})`;
      case "ForNumericStatement": {
        const v = _ast2js(ast.variable);
        const step = ast.step == null ? 1 : _ast2js(ast.step);
        let start = _ast2js(ast.start);
        let compare_op;
        if (start === 1) {
          start = 0;
          compare_op = step < 0 ? ">" : "<";
        } else {
          compare_op = step < 0 ? ">=" : "<=";
        }
        return `for (let ${v}=${start}; ${v} ${compare_op} ${_ast2js(ast.end)}; ${v}=${v}+${step}) {\n${_ast2js(
          ast.body
        )}\n}`;
      }

      case "ForGenericStatement": {
        let iter;
        let indexIgnored = true;
        if (opts.tryUseOfLoop && ast.variables.length === 2) {
          const isIndexVarible = (node) => {
            if (typeof node == "object" && node.type == "Identifier" && node.name == ast.variables[0].name) {
              indexIgnored = false;
            }
          };
          traverseAst(ast.body, isIndexVarible);
          if (indexIgnored) ast.variables = ast.variables.slice(1);
        }
        if (ast.iterators.length == 1) {
          const iter_name = ast.iterators[0].base.name;
          if (iter_name == "ipairs") {
            iter = `${_ast2js(ast.iterators[0].arguments)}${indexIgnored ? "" : ".entries()"}`;
          } else if (iter_name == "pairs") {
            iter = `Object.entries(${_ast2js(ast.iterators[0].arguments)})`;
          } else {
            iter = ast.iterators.map(_ast2js);
          }
        } else {
          iter = ast.iterators.map(_ast2js);
        }
        return `for (let ${smartPack(ast.variables)} of ${iter}) {\n${_ast2js(ast.body)}}`;
      }
      case "WhileStatement":
        return `while (${_ast2js(ast.condition)}) {${_ast2js(ast.body)}}`;
      default:
        throw new Error(`Unsupported AST node type: ${ast.type}`);
    }
  }
  try {
    return _ast2js(ast);
  } catch (error) {
    console.error(error);
    return `[${error.message}]`;
  }
}

function lua2js(lua_code, opts) {
  let js = "";
  try {
    js = ast2js(lua2ast(lua_code), opts);
    return prettier.format(js, {
      parser: "babel",
      rules: { "no-debugger": "off" },
      plugins: [parserBabel],
    });
  } catch (error) {
    return `/*\n${error}\n*/\n${js}`;
  }
}
export { lua2ast, lua2js, ast2js, defaultOptions };
