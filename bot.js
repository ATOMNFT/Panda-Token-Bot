require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { ethers } = require('ethers');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const PANDA_TOKEN = process.env.PANDA_CONTRACT_ADDRESS;

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

const walletMap = new Map();

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (msg) => {
  if (!msg.content.startsWith('!') || msg.author.bot) return;

  const [command, arg] = msg.content.trim().split(" ");

  if (command === '!setwallet') {
    if (!ethers.isAddress(arg)) {
      return msg.reply("❌ That doesn't look like a valid wallet address.");
    }
    walletMap.set(msg.author.id, arg);
    msg.reply(`✅ Wallet address saved: \`${arg}\``);
  }

  else if (command === '!balance') {
    const userWallet = walletMap.get(msg.author.id);
    if (!userWallet) {
      return msg.reply("⚠️ You need to set a wallet first using `!setwallet <address>`.");
    }

    try {
      const contract = new ethers.Contract(PANDA_TOKEN, ERC20_ABI, provider);
      const [balance, decimals, symbol] = await Promise.all([
        contract.balanceOf(userWallet),
        contract.decimals(),
        contract.symbol()
      ]);
      const formatted = ethers.formatUnits(balance, decimals);

	  const embed = new EmbedBuilder()
	  .setTitle(`🐼 Panda Token Balance`)
	  .setDescription(`Wallet: \`${userWallet}\``)  // ✅ Correct
	  .addFields({ name: 'Balance', value: `**${formatted} ${symbol}**`, inline: true })
	  .setColor(0x34D399)
	  .setFooter({ text: `Data from Abstract chain` });

      msg.reply({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      msg.reply("❌ Couldn't fetch your Panda balance. Please try again later.");
    }
  }

  else if (command === '!price') {
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/abs/${PANDA_TOKEN}`);
      const data = await res.json();
      const price = data?.pair?.priceUsd;

      if (!price) {
        return msg.reply("⚠️ Price data not available for Panda token.");
      }

      const embed = new EmbedBuilder()
        .setTitle(`📈 Panda Token Price`)
        .addFields({ name: 'USD Price', value: `$${Number(price).toFixed(6)} USD`, inline: true })
        .setColor(0x93C5FD)
        .setFooter({ text: 'Powered by Dexscreener' });

      msg.reply({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      msg.reply("❌ Couldn't fetch the Panda token price.");
    }
  }
});

client.login(process.env.DISCORD_TOKEN);