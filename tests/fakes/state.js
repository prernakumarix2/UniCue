// Shared in-memory state for the fake Firebase used by the end-to-end test.
export const state = {
  adminUid: "xrZS4IcV9FNglMXn5ret53skmwD2",
  user: null,                 // currently signed-in user { uid, email } or null (student / signed out)
  accounts: {},               // email -> { uid, password }
  docs: { information: new Map(), placements: new Map(), meta: new Map() },
  reads: 0,                   // document reads billed so far (Spark quota check)
  counter: 0
};
