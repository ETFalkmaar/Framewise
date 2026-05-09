/**
 * Helper that turns a setter-bound singleton into a typed proxy.
 *
 * Usage:
 *   const { proxy: tenantsRepo, set: setTenantsRepo } = createRepoProxy<TenantsRepository>('tenantsRepo');
 *   export { tenantsRepo, setTenantsRepo };
 *
 * The proxy throws a descriptive error if a method is called before the
 * adapter wiring runs. This keeps all repository files identical-looking
 * and avoids "Cannot read properties of undefined" stack traces.
 */
export function createRepoProxy<T extends object>(
  name: string
): {
  proxy: T;
  set: (impl: T) => void;
} {
  let impl: T | undefined;

  const proxy = new Proxy({} as T, {
    get(_target, prop, receiver) {
      if (!impl) {
        throw new Error(`${name} not initialised — wire the adapter via @/lib/data first`);
      }
      return Reflect.get(impl, prop, receiver);
    },
  });

  return {
    proxy,
    set: (newImpl: T) => {
      impl = newImpl;
    },
  };
}
