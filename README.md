# @xiangnanscu/lua2js

[@xiangnanscu/lua2js](https://xiangnanscu.github.io/lua2js/) transform lua to js literally.

# Install

```sh
npm install -g @xiangnanscu/lua2js
```

# Usage

## command

Concat one or more js files and transform them to one lua string:

```sh
lua2js [options] file1, file2, ...
```

where options are:

```js
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
```

### Options Details

#### printToConsoleLog

Default: `true`
Convert `print` to `console.log`.

**Input Lua:**

```lua
print("hello world")
```

**Output JS (Default):**

```js
console.log("hello world");
```

#### tryUseOfLoop

Default: `true`
Try to use `for...of` loop for `ipairs` or `pairs` when the index is not used.

**Input Lua:**

```lua
for i, v in ipairs(t) do
    print(v)
end
```

**Output JS (Default):**

```js
for (let v of t) {
  console.log(v);
}
```

#### indexMinusOne

Default: `true`
Decrement numeric index by 1 (Lua is 1-based, JS is 0-based).

**Input Lua:**

```lua
a = t[1]
```

**Output JS (Default):**

```js
a = t[0];
```

#### returnNilToThrow

Default: `true`
Convert `return nil, err` to `throw new Error(err)`.

**Input Lua:**

```lua
return nil, "error message"
```

**Output JS (Default):**

```js
throw new Error("error message");
```

#### errorToThrow

Default: `true`
Convert `error(msg)` to `throw new Error(msg)`.

**Input Lua:**

```lua
error("something wrong")
```

**Output JS (Default):**

```js
throw new Error("something wrong");
```

#### tostring

Default: `true`
Convert `tostring(x)` to `String(x)`.

**Input Lua:**

```lua
s = tostring(123)
```

**Output JS (Default):**

```js
let s = String(123);
```

#### dict

Default: `true`
Convert `dict(t)` calls (or `utils.dict`) to object spread syntax.

**Input Lua:**

```lua
d = dict(t)
```

**Output JS (Default):**

```js
let d = { ...t };
```

#### list

Default: `true`
Convert `list(t)` calls (or `utils.list`) to array spread syntax.

**Input Lua:**

```lua
l = list(t)
```

**Output JS (Default):**

```js
let l = [...t];
```

#### unpack

Default: `true`
Convert `unpack(t)` to spread syntax `...t`.

**Input Lua:**

```lua
f(unpack(t))
```

**Output JS (Default):**

```js
f(...t);
```

#### tonumber

Default: `true`
Convert `tonumber(x)` to `Number(x)`.

**Input Lua:**

```lua
n = tonumber("123")
```

**Output JS (Default):**

```js
let n = Number("123");
```

#### class

Default: `true`
Enable class syntax transformation for `class "Name"` or `class(Base)`.

**Input Lua:**

```lua
class "Person"
```

**Output JS (Default):**

```js
class Person {}
```

#### selfToThis

Default: `true`
Convert `self` to `this` in methods.

**Input Lua:**

```lua
function Person:say()
    print(self.name)
end
```

**Output JS (Default):**

```js
Person.prototype.say = function () {
  console.log(this.name);
};
```

#### clsToThis

Default: `true`
Convert `cls` to `this` in static methods.

**Input Lua:**

```lua
function Person.create(cls)
    return cls()
end
```

**Output JS (Default):**

```js
Person.create = function () {
  return new this();
};
```

#### typeToTypeof

Default: `true`
Convert `type(x)` to `typeof(x)`.

**Input Lua:**

```lua
t = type(x)
```

**Output JS (Default):**

```js
let t = typeof x;
```

#### stringFormat

Default: `true`
Convert `string.format` to template literals (when using `%s`).

**Input Lua:**

```lua
s = string.format("hello %s", name)
```

**Output JS (Default):**

```js
let s = `hello ${name}`;
```

#### tableConcat

Default: `true`
Convert `table.concat` to `.join`.

**Input Lua:**

```lua
s = table.concat(t, ",")
```

**Output JS (Default):**

```js
let s = t.join(",");
```

#### tableInsert

Default: `true`
Convert `table.insert` to `.push` or `.unshift`.

**Input Lua:**

```lua
table.insert(t, v)
table.insert(t, 1, v)
```

**Output JS (Default):**

```js
t.push(v);
t.unshift(v);
```

#### camelStyle

Default: `false`
Convert snake_case variables to camelCase.

**Input Lua:**

```lua
local my_variable = 1
```

**Output JS (with --camelStyle):**

```js
let myVariable = 1;
```

### examples

Basic:

```sh
lua2js foo.lua > foo.js
```

To disable a feature `--no-[option]`:

```sh
lua2js --no-camelStyle foo.lua
```

To enable a feature `--[option]`:

```sh
lua2js --camelStyle foo.lua
```

## api

```js
import { lua2js } from "lua2js";

const jscode = lua2js(`local snake_var = 1`, { camelStyle: true });
// let snakeVar = 1;
```

## see also

[@xiangnanscu/js2lua](https://xiangnanscu.github.io/js2lua/) transform js to lua

## todo
