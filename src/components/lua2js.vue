<script setup>
import { ref, computed } from 'vue'
import { lua2js, lua2ast } from '../lua2js.js'
import fs from "file-saver";

const jscodeRef = ref(null)
const luacode = ref(`\
t[#t+1] = 1
table_insert(t,1,a)
table.insert(t,1,a)
table_insert(t, 1)
table.insert(t, 1)
local function foo(x, y)
  return x + y
end
function c.foo(x, y)
  return x + y
end
function c.foo(self, x, y)
  return x + y + self.n
end
function c:foo(x, y)
  return x + y + self.n
end
local a = class {
  p1 = 'Hi class property p1',
  p2 = 'Hi class property p2',
  classMethod = function(cls)
    cls.sayClassHi()
  end,
  sayClassHi = function(cls)
    console.log(cls.p1)
  end,
  instanceMethod = function(self)
    self.sayInstanceHi()
  end,
  sayInstanceHi = function(self)
    console.log(this.p2)
  end
}
type(x+1)
assert(a > 1)
assert(a > 1, "error: a <= 1")
table.concat(t, ",")
table_concat(t, ",")
table_concat({1,2,3}, ",")
`)
const jscode = computed(() => lua2js(luacode.value))
const jscode_highlight_html = computed(() => hljs.highlight(jscode.value, {language: 'js'}).value)
function copyJs() {
  CopyToClipboard('jscode');
}
function saveJsAs() {
  fs.saveAs(new Blob([jscode.value]), "test.js")
}
function CopyToClipboard(containerid) {
  if (window.getSelection) {
    if (window.getSelection().empty) { // Chrome
      window.getSelection().empty();
    } else if (window.getSelection().removeAllRanges) { // Firefox
      window.getSelection().removeAllRanges();
    }
  } else if (document.selection) { // IE?
    document.selection.empty();
  }

  if (document.selection) {
    var range = document.body.createTextRange();
    range.moveToElementText(document.getElementById(containerid));
    range.select().createTextRange();
    document.execCommand("copy");
  } else if (window.getSelection) {
    var range = document.createRange();
    range.selectNode(document.getElementById(containerid));
    window.getSelection().addRange(range);
    document.execCommand("copy");
  }
}
</script>

<template>
  <div>
    <div class="row">
      <div class="col">
        <div style="text-align: center;">
          <h1><a href="https://github.com/xiangnanscu/lua2js">lua2js</a> - transform lua to js literally </h1>
          <div></div>
          <button @click="luacode=''">clear textarea</button>
          <button @click="copyJs">copy js</button><button @click="saveJsAs">save as</button><br />
        </div>
      </div>
    </div>
    <div class="row">
      <div class="col">
        <textarea rows="10" style="height:800px" class="form-control" :value="luacode"
          @input="luacode = $event.target.value"></textarea>
      </div>
      <div class="col">
        <highlightjs language='lua' :code="luacode" />
      </div>
      <div class="col">
        <!-- <pre id="jscode2"><code class="language-javascript" v-html="jscode_highlight_html"></code></pre> -->
        <highlightjs id="jscode" language='javascript' :code="jscode" />
      </div>
    </div>
  </div>
</template>

<style scoped>
a {
  color: #42b983;
}
</style>
