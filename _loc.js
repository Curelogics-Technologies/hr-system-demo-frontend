const fs=require('fs');
const S = {
  it: {
    reopen_action:"Riapri e rimanda a HR",
    reopen_success:"Richiesta riaperta e riassegnata a HR",
    unverified_explain:"Questa richiesta risulta approvata ma nessuna persona l\u2019ha decisa: è stata approvata automaticamente per inattività. Non può essere approvata di nuovo.",
    NEEDS_REOPEN:"Questa richiesta risulta già approvata, ma da nessuna persona. Usa Riapri per rimandarla a HR per una decisione reale.",
    REOPEN_ADMIN_ONLY:"Solo un amministratore può riaprire una richiesta approvata automaticamente.",
    REOPEN_NOT_UNVERIFIED:"Questa richiesta è stata approvata da una persona e non può essere riaperta.",
  },
  en: {
    reopen_action:"Reopen and send back to HR",
    reopen_success:"Request reopened and reassigned to HR",
    unverified_explain:"This request shows as approved but nobody decided it — it was approved automatically for inactivity. It cannot be approved again.",
    NEEDS_REOPEN:"This request is already approved, but by nobody. Use Reopen to send it back to HR for a real decision.",
    REOPEN_ADMIN_ONLY:"Only an administrator can reopen an automatically-approved request.",
    REOPEN_NOT_UNVERIFIED:"This request was approved by a person and cannot be reopened.",
  },
};
for (const lang of ['it','en']) {
  const p=`src/i18n/locales/${lang}.ts`;
  let s=fs.readFileSync(p,'utf8');
  const v=S[lang];
  // leave.* keys
  if (!s.includes('reopen_action:')) {
    s=s.replace(/(\n(\s*)badge_unverified: )/,
      `\n$2reopen_action: ${JSON.stringify(v.reopen_action)},\n$2reopen_success: ${JSON.stringify(v.reopen_success)},\n$2unverified_explain: ${JSON.stringify(v.unverified_explain)},$1`);
  }
  // errors.* keys
  if (!s.includes('NEEDS_REOPEN:')) {
    s=s.replace(/(\n(\s*)ROLE_NOT_IN_CHAIN: )/,
      `\n$2NEEDS_REOPEN: ${JSON.stringify(v.NEEDS_REOPEN)},\n$2REOPEN_ADMIN_ONLY: ${JSON.stringify(v.REOPEN_ADMIN_ONLY)},\n$2REOPEN_NOT_UNVERIFIED: ${JSON.stringify(v.REOPEN_NOT_UNVERIFIED)},$1`);
  }
  fs.writeFileSync(p,s);
  console.log(lang+' updated');
}
