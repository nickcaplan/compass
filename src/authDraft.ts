// Drafts stay on this device. Account drafts never share an ownerless slot.
export const AUTH_DRAFT_KEY = 'compass-auth-draft';
export const AUTH_FLOW_KEY = 'compass-auth-flow';
export const accountDraftKey = (id: string) => `${AUTH_DRAFT_KEY}:account:${id}`;
export const emailDraftKey = (email: string) => `${AUTH_DRAFT_KEY}:email:${email.trim().toLowerCase()}`;
export const googleDraftKey = (flow: string) => `${AUTH_DRAFT_KEY}:google:${flow}`;
export type DraftBinding = { accountId: string } | { email: string } | { googleFlow: string };
export function bindingMatches(binding: unknown, user: { id: string; email?: string }, flow: string | null): boolean {
  if (!binding || typeof binding !== 'object') return false;
  if ('accountId' in binding) return binding.accountId === user.id;
  if ('email' in binding) return typeof binding.email === 'string' && binding.email === user.email?.trim().toLowerCase();
  if ('googleFlow' in binding) return Boolean(flow && binding.googleFlow === flow);
  return false;
}
