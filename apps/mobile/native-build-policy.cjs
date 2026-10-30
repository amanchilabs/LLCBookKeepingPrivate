function nativeBuildPolicy(environment) {
  const securityNegativeBuild = environment.LLCB_SECURITY_NEGATIVE_SQLITE === '1';
  if (securityNegativeBuild && environment.EAS_BUILD_PROFILE === 'production') {
    throw new Error('The SQLCipher-disabled security-negative build cannot use the production build profile.');
  }
  return { sqlCipherEnabled: !securityNegativeBuild, securityNegativeBuild };
}

module.exports = { nativeBuildPolicy };
