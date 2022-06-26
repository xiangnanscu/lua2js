<script setup>
// This starter template is using Vue 3 <script setup> SFCs
// Check out https://vuejs.org/api/sfc-script-setup.html#script-setup
import lua2js from './components/lua2js.vue'
</script>

<template>
  <div class="row">
    <div class="col">
      <lua2js />
    </div>
  </div>
</template>

<style lang="scss">
$enable-caret: true !default;
$enable-rounded: false !default;
$enable-shadows: false !default;
$enable-gradients: false !default;
$enable-transitions: true !default;
$enable-grid-classes: true !default;
$enable-print-styles: true !default;

$blue: #04405e !default;
// $navbar-light-color: #d8d8d8;
// $navbar-light-hover-color: #fff;
// $navbar-light-active-color: #fff;
// $dark: #417690;
// $navbar-light-active-color: #fff;
// $navbar-dark-color:                #fff !default;
// $navbar-dark-hover-color:          #fff !default;
// $light: #417690;
$sidebar-background-color: #eeeeee;
$sidebar-hover-color: #37424f;
@import "node_modules/bootstrap/scss/bootstrap.scss";
</style>
