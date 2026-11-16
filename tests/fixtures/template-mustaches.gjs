import { concat, get } from '@ember/helper';
import formatDate from './format-date';

<template>
  {{@title}}
  {{this.count}}
  {{@user.profile.name}}
  {{formatDate @date format="short" locale=this.locale}}
  {{concat "Hello, " (get @user "name") "!"}}
  {{if @isActive "on" "off"}}
  {{{@trustedHtml}}}
  {{~@trimmed~}}
  {{has-block "header"}}
  {{yield}}
  {{yield @model to="inverse"}}
  {{outlet}}
  {{debugger}}
  {{log "value" this.value}}
</template>
