'use strict';
// Only specifically identified observational operations can be run without a per-call prompt.
// Anything not listed is ASK even if it starts with get/list. Some 'get' calls return credentials.
function canAuto(name) {
  if(/(?:env|credential|secret|token|connection|password|private|api_key|apikey)/i.test(name))return false;
  return /^(?:liara_(?:list_[a-z0-9_]+|get_app|get_user|get_balance|get_billing|get_free_credit|diagnose_app|deploy_preflight|list_plans|list_networks)|abroo_status)$/i.test(name);
}
function policyFor(config, name) {
  const p=config?.toolPolicies?.[name] || 'ask';
  if (p === 'disabled') return 'disabled';
  if (p === 'automatic' && canAuto(name)) return 'automatic';
  return 'ask';
}
function normalizePolicy(name, choice){
  if(!['automatic','ask','disabled'].includes(choice))throw new Error('Invalid tool policy');
  if(choice==='automatic'&&!canAuto(name))throw new Error('Automatic mode is not permitted for this tool');
  return choice;
}
module.exports={canAuto,policyFor,normalizePolicy};
