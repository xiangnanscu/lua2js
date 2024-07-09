<script setup>
import { ref, computed, watch } from "vue";
import { lua2js, lua2ast, defaultOptions } from "../lua2js.mjs";
import luastring from "./code.lua?raw"
import fs from "file-saver";

const parseOptions = {};
const showLuacode = ref(null);
const showLuaAst = ref(false);
const luacode = ref(luastring);
const optionNames = Object.keys(defaultOptions);
const selectNames = ref(
  Object.entries(defaultOptions)
    .filter(([k, v]) => v)
    .map(([k, v]) => k)
);
const selectOptions = computed(() => {
  const opts = {}
  selectNames.value.forEach((name) => (opts[name] = true));
  optionNames.filter(name=>!selectNames.value.includes(name)).forEach(name=>{opts[name]=false});
  return opts
});
const jscode = computed(() => {
  return lua2js(luacode.value, selectOptions.value)
});

const luaast = computed(() => lua2ast(luacode.value, selectOptions.value));
const jscode_highlight_html = computed(() => hljs.highlight(jscode.value, { language: "js" }).value);
function copyJs() {
  CopyToClipboard("jscode");
}
function saveJsAs() {
  fs.saveAs(new Blob([jscode.value]), "test.js");
}
function CopyToClipboard(containerid) {
  if (window.getSelection) {
    if (window.getSelection().empty) {
      // Chrome
      window.getSelection().empty();
    } else if (window.getSelection().removeAllRanges) {
      // Firefox
      window.getSelection().removeAllRanges();
    }
  } else if (document.selection) {
    // IE?
    document.selection.empty();
  }

  if (document.selection) {
    const range = document.body.createTextRange();
    range.moveToElementText(document.getElementById(containerid));
    range.select().createTextRange();
    document.execCommand("copy");
  } else if (window.getSelection) {
    const range = document.createRange();
    range.selectNode(document.getElementById(containerid));
    window.getSelection().addRange(range);
    document.execCommand("copy");
  }
}
const checkAll = ref(false);
watch(checkAll, (checkAll) => {
  if (checkAll) {
    selectNames.value = [...optionNames];
  } else {
    selectNames.value = [];
  }
});
watch(selectNames, (selectNames) => {
  // force jscode re-render
  luacode.value = luacode.value +' ';
})
</script>

<template>
  <div>
    <div class="row">
      <div class="col"></div>
    </div>
    <div class="row">
      <div class="col-1">
        <div :class="{ 'error-wrapper': error }">
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="label-showlua" v-model="showLuacode" />
            <label class="form-check-label" for="label-showlua"> show lua code </label>
          </div>
          <div class="border"></div>
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="label-all" v-model="checkAll" />
            <label class="form-check-label" for="label-all" style="color: red"> enable all features</label>
          </div>
          <div v-for="(c, i) of optionNames" :key="i" :class="{ 'form-check': true }">
            <input class="form-check-input" type="checkbox" :id="`label` + i" v-model="selectNames" :value="c" />
            <label class="form-check-label" :for="`label` + i">
              {{ c }}
            </label>
          </div>
        </div>
      </div>
      <div class="col">
        <button @click="luacode = ''">clear textarea</button>
        <textarea
          rows="10"
          style="height: 800px"
          class="form-control"
          :value="luacode"
          @input="luacode = $event.target.value"
        ></textarea>
      </div>
      <div v-if="showLuacode" class="col">
        <div class="form-check-inline">
          <label class="form-check-label">
            <input @input="showLuaAst = !showLuaAst" :value="showLuaAst" type="checkbox" class="form-check-input" />show
            lua ast</label
          >
        </div>
        <div v-if="showLuaAst">
          <pre>{{ luaast }}</pre>
        </div>
        <div v-else>
          <highlightjs language="lua" :code="luacode" />
        </div>
      </div>
      <div class="col">
        <!-- <pre id="jscode2"><code class="language-javascript" v-html="jscode_highlight_html"></code></pre> -->
        <button @click="copyJs">copy js</button>
        <button @click="saveJsAs">save as</button>
        <highlightjs id="jscode" language="javascript" :code="jscode" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.col {
  overflow: scroll;
}
</style>
