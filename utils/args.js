export function argValue(args, flag) {
    const idx = args.indexOf(flag);
    if (idx >= 0 && args[idx + 1]) return args[idx + 1];
    const prefixed = args.find(a => a.startsWith(flag + '='));
    return prefixed ? prefixed.split('=').slice(1).join('=') : null;
}
