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
### examples
Basic:
```sh
lua2js foo.lua > foo.js
```
To disable a feature `--no-[option]`:
```sh
lua2js --no-printToConsoleLog foo.lua
```
To enable a feature `--[option]`:
```sh
lua2js --printToConsoleLog foo.lua
```
## api
```js
import { lua2js } from 'lua2js';
lua2js(`local a = 1`, {printToConsoleLog:true})
```
## see also
[@xiangnanscu/js2lua](https://xiangnanscu.github.io/js2lua/) transform js to lua