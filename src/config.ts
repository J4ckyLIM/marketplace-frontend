const config = {
  PROVIDER_NETWORK: import.meta.env.ODBS_PROVIDER_NETWORK,
  PROVIDER_HOSTNAME: import.meta.env.OCBD_PROVIDER_HOSTNAME,
  GITHUB_CLIENT_ID: import.meta.env.ODBS_GITHUB_CLIENT_ID,
  GITHUB_REDIRECT_URI: import.meta.env.ODBS_GITHUB_REDIRECT_URI,
  API_HOSTNAME: import.meta.env.ODBS_API_HOSTNAME,
  REGISTRY_CONTRACT_ADDRESS: import.meta.env.ODBS_REGISTRY_CONTRACT_ADDRESS,
};

export default config;