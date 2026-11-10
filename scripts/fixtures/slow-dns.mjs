// Test-process-only preload. Holds scanner slots without contacting any external host.
import { Resolver } from 'node:dns/promises';
Resolver.prototype.resolve4 = Resolver.prototype.resolve6 = async function () {
  await new Promise(resolve => setTimeout(resolve, 2000));
  return [];
};
