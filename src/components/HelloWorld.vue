<script setup>
import { ref, computed } from 'vue'
import { lua2ast, lua2js, ast2js } from './lua2js.js'
import fs from "file-saver";

defineProps({
  msg: String
})
const jscodeRef = ref(null)
const count = ref(0)
const luacode = ref(`
Sql = class {
  a = 1,
  foo = function(self, n)
    self.n = n
    return 'instance method'
  end,
  bar = function(cls, n)
    cls.n = n
    return 'class method'
  end
}
`)
const jscode = computed(()=>lua2js(luacode.value))
function copyJs() {
  jscodeRef.value.select();
  document.execCommand("copy");
}
function saveJsAs() {
  fs.saveAs(new Blob([jscode.value]), "test.js")
}
</script>

<template>
  <h1>lua 2 js</h1>
  <div class="row">
    <div class="col"><textarea class="form-control" :value="luacode" @input="luacode = $event.target.value"></textarea></div>
  </div>
  <div class="row">
    <pre class="col-4">{{ lua2ast(luacode) }}</pre>
    <div class="col-8">
      <button @click="copyJs">复制</button><button @click="saveJsAs">另存为</button><br/>
      <textarea :value="jscode" ref="jscode" class="form-control" rows="100"></textarea>
    </div>
  </div>
</template>

<style scoped>
a {
  color: #42b983;
}
</style>
