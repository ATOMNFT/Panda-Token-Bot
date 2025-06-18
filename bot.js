require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { ethers } = require('ethers');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const PANDA_PAIR = process.env.PANDA_PAIR_ADDRESS;
const PANDA_TOKEN = '0x67C778B5e5705Aaa46707F3F16e498BeEf627b0b';

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
      .setDescription(`Wallet: \`${userWallet}\``)
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
      const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/abs/${PANDA_PAIR}`);
      const data = await res.json();
      const pair = data?.pair;

      if (!pair || !pair.priceUsd) {
        return msg.reply("⚠️ Price data not available for Panda token.");
      }

      const price = Number(pair.priceUsd).toFixed(7);
      const change = parseFloat(pair.priceChange.h24).toFixed(2);
      const direction = change >= 0 ? '📈 Up' : '📉 Down';
      const changeColor = change >= 0 ? 0x10B981 : 0xEF4444;

      const embed = new EmbedBuilder()
        .setTitle(`🐼 Panda Token Price`)
        .addFields(
          { name: 'USD Price', value: `$${price}`, inline: true },
          { name: '24h Change', value: `${direction} ${Math.abs(change)}%`, inline: true }
        )
        .setColor(changeColor)
        .setFooter({ text: 'Powered by Dexscreener' });

      msg.reply({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      msg.reply("❌ Couldn't fetch the Panda token price.");
    }
  }
});

client.login(process.env.DISCORD_TOKEN);