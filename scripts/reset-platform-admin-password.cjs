const { PrismaClient } = require('@prisma/client');
const { scryptSync, randomBytes } = require('node:crypto');
const { stdin, stdout } = require('node:process');
const readline = require('node:readline');

const EMAIL = 'radjapong@nexora.com';
const db = new PrismaClient();

async function promptHidden(question) {
  if (!stdin.isTTY) throw new Error('Run this script in an interactive terminal.');
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: stdin, output: stdout, terminal: true });
    const originalWrite = rl._writeToOutput.bind(rl);
    rl._writeToOutput = function (str) {
      if (this._hideInput) this.output.write(str.replace(/[^\r\n]/g, '*'));
      else originalWrite(str);
    };
    rl.question(question, answer => { rl.close(); stdout.write('\n'); resolve(answer); });
    rl._hideInput = true;
    rl.on('SIGINT', () => { rl.close(); reject(new Error('Cancelled')); });
  });
}

async function main() {
  const user = await db.user.findUnique({ where: { email: EMAIL }, select: { id: true, active: true, platformAdmin: true } });
  if (!user || !user.active || !user.platformAdmin) throw new Error('Target account missing, inactive, or not a platform administrator. No changes made.');
  stdout.write(`Password reset for ${EMAIL}. This changes only the passwordHash field.\n`);
  const password = await promptHidden('Enter NEW password (16+ characters): ');
  if (password.length < 16) throw new Error('Password must contain at least 16 characters. No changes made.');
  const confirm = await promptHidden('Confirm NEW password: ');
  if (password !== confirm) throw new Error('Passwords do not match. No changes made.');
  const salt = randomBytes(16).toString('hex');
  const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
  const result = await db.user.updateMany({ where: { id: user.id, active: true, platformAdmin: true }, data: { passwordHash } });
  if (result.count !== 1) throw new Error('Account changed during reset. No password updated.');
  stdout.write('Password reset successful. Sign in with the new password.\n');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
