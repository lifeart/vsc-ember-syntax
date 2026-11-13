<template>
  {{"a string literal"}}
  {{'single quotes'}}
  {{42}}
  {{-1.5}}
  {{true}} {{false}} {{null}} {{undefined}}
  {{hash compact=true count=3 label=null}}
  <Panel @collapsed={{false}} />
</template>
