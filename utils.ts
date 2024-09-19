export function containsTrigger(strInput: string, strTriggers: string[]) {
  return strTriggers.some(trigger => strInput.includes(trigger));
}
