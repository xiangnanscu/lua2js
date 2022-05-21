<script setup>
import { ref } from 'vue'
import { lua2ast, lua2js, ast2js } from './lua2js.js'

defineProps({
  msg: String
})

const count = ref(0)
const luacode = ref("")
</script>

<template>
  <h1>lua 2 js</h1>
  <div class="row">
    <div class="col"><textarea class="form-control" :value="luacode" @input="luacode = $event.target.value"></textarea></div>
  </div>
  <div class="row">
    <pre class="col-4">{{ lua2ast(luacode) }}</pre>
    <div class="col-8">{{ lua2js(luacode) }}</div>
  </div>
</template>

<style scoped>
a {
  color: #42b983;
}
</style>
