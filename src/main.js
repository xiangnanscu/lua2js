import { createApp } from 'vue'
import App from './App.vue'
import 'highlight.js/styles/github.css'
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import lua from 'highlight.js/lib/languages/lua';
import hljsVuePlugin from "@highlightjs/vue-plugin"

const app = createApp(App)
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('lua', lua);
app.use(hljsVuePlugin)
app.mount('#app')
