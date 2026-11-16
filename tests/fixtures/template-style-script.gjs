<template>
  <style>
    .card { color: red; }
    .card:hover > .title::after { content: "{{not-handlebars}}"; }
    @media (min-width: 600px) { .card { padding: 1rem; } }
  </style>
  <style scoped>
    p { margin: 0 }
  </style>
  <script>
    const x = 1 < 2 && 3 > 2;
    console.log(`template literal ${x}`);
  </script>
  <div class="card"><p class="title">{{@title}}</p></div>
</template>

const after = 1;
