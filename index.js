require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { ethers } = require('ethers');

const token = process.env.TELEGRAM_BOT_TOKEN;
const rpcUrl = process.env.RPC_URL || "https://rpc.sepolia.org";

const coreAddress = process.env.CORE_ADDRESS || process.env.CONTRACT_ADDRESS;
const nftAddress = process.env.NFT_ADDRESS;

if (!token) {
  console.error("❌ Thiếu TELEGRAM_BOT_TOKEN trong tệp .env!");
  process.exit(1);
}

if (!coreAddress) {
  console.error("❌ Thiếu CORE_ADDRESS hoặc CONTRACT_ADDRESS trong tệp .env!");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const provider = new ethers.JsonRpcProvider(rpcUrl);

// Mở rộng ABI để tương thích với các tên hàm khác nhau trên contract
const SQUEEK_CORE_ABI = [
  "function getCurrentRound() view returns (uint256)",
  "function currentRound() view returns (uint256)",
  "function round() view returns (uint256)",
  "function totalRounds() view returns (uint256)"
];

const SQUEEK_NFT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)"
];

const coreContract = new ethers.Contract(coreAddress, SQUEEK_CORE_ABI, provider);
const nftContract = new ethers.Contract(nftAddress || coreAddress, SQUEEK_NFT_ABI, provider);

console.log("🐹 Squeekchain Telegram Bot đã sẵn sàng và đang chạy...");

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    `👋 Chào mừng bạn đến với **Squeekchain Monitor Bot**!\n\n` +
    `🤖 Bot được kết nối trực tiếp với hệ sinh thái Squeekchain trên Sepolia Testnet.\n\n` +
    `📌 **Các lệnh khả dụng:**\n` +
    `/status - Kiểm tra trạng thái mạng lưới và Round hiện tại\n` +
    `/squeek <tokenId> - Kiểm tra chủ sở hữu của một Squeek NFT cụ thể\n` +
    `/help - Xem trợ giúp`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const loadingMsg = await bot.sendMessage(chatId, "⏳ Đang truy vấn dữ liệu từ Sepolia Testnet...");

    let currentRound = "N/A";
    
    // Thử gọi lần lượt các hàm khả dĩ để lấy round
    try {
      currentRound = await coreContract.getCurrentRound();
    } catch (e1) {
      try {
        currentRound = await coreContract.currentRound();
      } catch (e2) {
        try {
          currentRound = await coreContract.round();
        } catch (e3) {
          currentRound = "Đang cập nhật / On-chain Sync";
        }
      }
    }

    const blockNumber = await provider.getBlockNumber();

    const responseText = `
📊 **Squeekchain Network Status**
🔗 **Sepolia Block:** \`${blockNumber}\`
🔄 **Squeekchain Round:** \`${currentRound.toString()}\`
🏛 **Core Contract:** \`${coreAddress.substring(0, 6)}...${coreAddress.substring(38)}\`
🐹 **Trạng thái Squeektoshi:** Đang chạy tốt trên WHEELY9000!
    `.trim();

    bot.editMessageText(responseText, {
      chat_id: chatId,
      message_id: loadingMsg.message_id,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error("Lỗi /status:", error);
    bot.sendMessage(chatId, `❌ Lỗi kết nối blockchain: ${error.message}`);
  }
});

bot.onText(/\/squeek (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const tokenId = match[1];

  try {
    const owner = await nftContract.ownerOf(tokenId);
    bot.sendMessage(
      chatId,
      `🐹 **Squeek NFT #${tokenId}**\n👤 **Chủ sở hữu:** \`${owner}\``,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    bot.sendMessage(
      chatId,
      `❌ Không tìm thấy thông tin Squeek #${tokenId}. Hãy đảm bảo ID tồn tại hoặc hợp đồng đã triển khai đúng.`
    );
  }
});
