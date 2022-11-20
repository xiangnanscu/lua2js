import luaparse from "luaparse";
import prettier from "prettier/standalone.js";
import parserBabel from "prettier/parser-babel.js";

function joinUnderscore(length) {
  return Array.from({ length }, () => '_').join("")
}
function toCamel(s) {
  let status = -1
  let res = []
  let longUnderscoreCnt = 0
  for (const c of s) {
    if (c == '_') {
      if (status == -1) {
        res.push(c)
      } else if (status == 0) {
        status = 1
      } else if (status == 1 || status == 2) {
        status = 2
        longUnderscoreCnt += 1
      }
    } else if (status == -1) {
      //第一个非_字符
      res.push(c)
      status = 0
    } else if (status == 0) {
      res.push(c)
    } else if (status == 1) {
      if (/[A-Z]/.test(c)) {
        res.push('_' + c)
      } else {
        res.push(c.toUpperCase())
      }
      status = 0
    } else if (status == 2) {
      res.push(joinUnderscore(longUnderscoreCnt + 1) + c)
      longUnderscoreCnt = 0
      status = 0
    }
  }
  if (status == 1) {
    res.push('_')
  } else if (status == 2) {
    res.push(joinUnderscore(longUnderscoreCnt + 1))
  }
  return res.join('')
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
  constructor: "_constructor",
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
function insertPrototypeNode(base) {
  return {
    "type": "MemberExpression",
    "indexer": ".",
    "identifier": {
      "type": "Identifier",
      "name": "prototype"
    },
    "base": base
  }
}
function isClassExtends(ast) {
  return ast.base.type == 'Identifier' && ast.base.name == 'class' && ast.arguments instanceof Array && ast.arguments.length == 2
}
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
function isTableInsertCall(ast) {
  return ast.arguments?.length == 2 && (
    (ast.base?.type === "Identifier" && ast.base?.name === "table_insert") ||
    (ast.base?.type === "MemberExpression" &&
      ast.base?.identifier?.name === "insert" &&
      ast.base?.base?.name === "table")
  );
}
function isNumerOne(ast) {
  return ast.type == 'NumericLiteral' && ast.value == 1
}
function isTableInsertAtHeadCall(ast) {
  return ast.arguments?.length == 3 && isNumerOne(ast.arguments[1]) && (
    (ast.base?.type === "Identifier" && ast.base?.name === "table_insert") ||
    (ast.base?.type === "MemberExpression" &&
      ast.base?.identifier?.name === "insert" &&
      ast.base?.base?.name === "table")
  );
}
function luaInsert2JsUnshift(ast) {
  // tansform lua table.insert(t, 1) / table_insert(t, 1) to js t.push(1)
  let [base, index, element] = ast.arguments;
  return `${ast2js(base)}.unshift(${ast2js(element)})`;
}
function luaInsert2JsPush(ast) {
  // tansform lua table.insert(t, 1) / table_insert(t, 1) to js t.push(1)
  let [base, element] = ast.arguments;
  return `${ast2js(base)}.push(${ast2js(element)})`;
}

function isTableConcatCall(ast) {
  return (
    (ast.base?.type === "Identifier" && ast.base?.name === "table_concat") ||
    (ast.base?.type === "MemberExpression" &&
      ast.base?.identifier?.name === "concat" &&
      ast.base?.base?.name === "table")
  );
}

function luaConcat2JsJoin(ast) {
  // tansform lua table.concat(t, ',') / table_concat(t, ',') to js t.join(',')
  return `${ast2js(ast.arguments[0])}.join(${ast.arguments[1] ? ast2js(ast.arguments[1]) : '""'})`;
}
function isInstanceMethod(ast) {
  return ast.type == 'FunctionDeclaration' && ast.identifier?.type == 'MemberExpression' && ast.parameters[0] && ast.parameters[0].type == 'Identifier' && ast.parameters[0].name == 'self'
}
function isAssertCall(ast) {
  return ast.base?.type === "Identifier" && ast.base?.name === "assert";
}
function luaAssert2JsIfThrow(ast) {
  // tansform lua assert(bool, error) to js if (!bool) {throw new Error(error)}
  if (ast.arguments.length == 1) {
    return `if (!(${ast2js(ast.arguments[0])})) {throw new Error("assertion failed!")}`;
  } else {
    return `if (!(${ast2js(ast.arguments[0])})) {throw new Error(${ast2js(ast.arguments[1])})}`;
  }
}
function isTypeCall(ast) {
  return ast.base?.type === "Identifier" && ast.base?.name === "type";
}

function luaType2JsTypeof(ast) {
  // tansform lua type(foo) js typeof(foo)
  return `typeof(${ast2js(ast.arguments[0])})`;
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
function getLuaStringToken(s) {
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
  s = getLuaStringToken(s);
  if (c == "[") {
    return "`" + s.replace("`", "\\`") + "`";
  } else {
    return c + s + c;
  }
}
function isReturnNilAndErr(ast) {
  return ast.arguments?.length == 2 && ast.arguments[0].type == 'NilLiteral'
}
function luaFormat2JsTemplate(ast) {
  let s = getLuaStringToken(ast.arguments[0].raw);
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

function isClassDeclare(ast) {
  return ast.variables.length == 1 && ast.init.length == 1 && ((ast.init[0].type == 'TableCallExpression' || ast.init[0].type == 'CallExpression') && ast.init[0].base?.name == 'class')
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
        return toCamel(IdentifierMap[ast.name] || ast.name)
      case "BreakStatement":
        return "break";
      case "DoStatement":
        return `{${ast2js(ast.body)}}`;
      case "AssignmentStatement":
      case "LocalStatement":
        if (isClassDeclare(ast)) {
          ast.init[0].className = toCamel(ast.variables[0].name)
          return ast2js(ast.init[0])
        }
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
        ast.left.isBinaryExpressionMode = true;
        ast.right.isBinaryExpressionMode = true;
        return `(${ast2js(ast.left)} ${binaryOpMap[ast.operator] || ast.operator} ${ast2js(ast.right)})`;
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
        return `(${ast2js(ast.left)} ${binaryOpMap[ast.operator] || ast.operator} ${ast2js(ast.right)})`;
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

            } else {

            }
          }
          return `{${ast2js(ast.fields, "\n")}}`;
        } else if (ast.fields.length === 0) {
          // try guess from later code whether contains t[#t+1] or table.concat(t)
          return '[]'
        } else {
          let is_pure_array = ast.fields.every((e) => e.type == "TableValue");
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
            ast.value.identifier = {
              "type": "Identifier",
              "name": ast.key.name
            }
            return `${ast2js(ast.value)}`;
          } else {
            return `${ast2js(ast.key)} = ${ast2js(ast.value)}`;
          }
        } else {
          return `${ast2js(ast.key)}: ${ast2js(ast.value)}`;
        }
      case "TableKey":
        return `[${ast2js(ast.key)}]: ${ast2js(ast.value)}`;
      case "TableValue":
        return ast2js(ast.value);
      case "IndexExpression":
        if (ast.index?.type == 'NumericLiteral' && ast.index.value >= 1) {
          ast.index.value = ast.index.value - 1
          return `${ast2js(ast.base)}[${ast2js(ast.index)}]`;
        } else {
          return `${ast2js(ast.base)}[${ast2js(ast.index)}]`;
        }

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
              return `${ast2js(ast.identifier)}(${ast2js(ast.parameters.slice(1), ", ")}) {${ast2js(ast.body)}}`;
            case "cls":
              traverseAst(ast.body, clsToThis);
              return `static ${ast2js(ast.identifier)}(${ast2js(ast.parameters.slice(1), ", ")}) {${ast2js(ast.body)}}`;
            default:
              return `${ast2js(ast.identifier)}(${ast2js(ast.parameters, ", ")}) {${ast2js(ast.body)}}`;
          }
        } else {
          if (
            ast.identifier?.type == "MemberExpression" &&
            ast.identifier?.indexer == "." &&
            ast.parameters[0]?.name == "self"
          ) {
            ast.identifier.base = insertPrototypeNode(ast.identifier.base)
            ast.parameters = ast.parameters.slice(1);
            traverseAst(ast.body, selfToThis);
          } else if (ast.identifier?.type == "MemberExpression" && ast.identifier?.indexer == ":") {
            ast.identifier.base = insertPrototypeNode(ast.identifier.base)
            traverseAst(ast.body, selfToThis);
          } else if (ast.identifier?.type == "MemberExpression" &&
            ast.identifier?.indexer == "." &&
            ast.parameters[0]?.name == "cls") {
            ast.parameters = ast.parameters.slice(1);
            traverseAst(ast.body, clsToThis);
          }
          let main = `(${ast.parameters.map(ast2js).join(", ")}){${ast2js(ast.body)}}`;
          if (ast.identifier == null) {
            return `function ${main}`;
          } else {
            let fnName = ast2js(ast.identifier);
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
        return `${ast2js(ast.base)}.${ast2js(ast.identifier)}`;
      case "ReturnStatement":
        if (isReturnNilAndErr(ast)) {
          return `throw new Error(${ast2js(ast.arguments[1])})`
        }
        tagVarargAsSpread(ast.arguments);
        if (ast.asExport) {
          return `export default ${smartPack(ast.arguments)}`;
        } else {
          return `return ${smartPack(ast.arguments)}`;
        }

      case "CallStatement":
        return ast2js(ast.expression);
      case "CallExpression":
        if (ast.base.type == "Identifier" && ast.base.name == "class" && ast.className) {
          ast.arguments[0].isClassMode = true
          const extendsToken = ast.arguments.length == 1 ? '' : 'extends ' + ast2js(ast.arguments[1])
          return `class ${ast.className} ${extendsToken} ${ast2js(ast.arguments[0])}`;
        } else if (isClassExtends(ast)) {
          let [cls, pcls] = ast.arguments
          cls.isClassMode = true
          return `class ${ast2js(cls)} extends ${ast2js(pcls)}`;
        } else if (isSelectLength(ast)) {
          return `varargs.length`;
        } else if (isSelectNumber(ast)) {
          return `varargs[${ast2js(ast.arguments[0])}]`;
        } else if (isStringFormatCall(ast)) {
          return luaFormat2JsTemplate(ast);
        } else if (isErrorCall(ast)) {
          return luaError2JsThrow(ast);
        } else if (isTableInsertCall(ast)) {
          return luaInsert2JsPush(ast);
        } else if (isTableInsertAtHeadCall(ast)) {
          return luaInsert2JsUnshift(ast);
        } else if (isTableConcatCall(ast)) {
          return luaConcat2JsJoin(ast);
          // } else if (isAssertCall(ast)) {
          //   return luaAssert2JsIfThrow(ast);
        } else if (isTypeCall(ast)) {
          return luaType2JsTypeof(ast);
        } else if (ast.arguments[0]?.name == "this") {
          tagVarargAsSpread(ast.arguments);
          let rest = ast.arguments.slice(1);
          if (ast.base.base) {
            ast.base.base = {
              "type": "MemberExpression",
              "indexer": ".",
              "identifier": {
                "type": "Identifier",
                "name": "prototype"
              },
              "base": ast.base.base
            }
          }
          return `${ast2js(ast.base)}.call(this${rest.length > 0 ? ", " : ""}${rest.map(ast2js).join(", ")})`;
        } else {
          tagVarargAsSpread(ast.arguments);
          return `${ast2js(ast.base)}(${ast.arguments.map(ast2js).join(", ")})`;
        }
      case "TableCallExpression":
        if (ast.base.type == "Identifier" && ast.base.name == "class") {
          ast.arguments.isClassMode = true;
          if (ast.className) {
            return `class ${ast.className} ${ast2js(ast.arguments)}`;
          } else {
            return `class ${ast2js(ast.arguments)}`;
          }
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