const { describe } = require('mocha');
const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');

const BN = ethers.BigNumber.from;

const {
  NAME,
  SYMBOL,
  TOTAL_SUPPLY,
  DECIMALS,
  TXN_LIMIT,
  WALLET_BALANCE_LIMIT,
  ANTI_BOT_PROTECTION,
  ZERO_ADDRESS,
} = require('./config/index.js');

describe('My Token Anti-Bot Protection', () => {
  let owner, user1, user2;
  let token;
  const DECIMAL_BN = BN(DECIMALS);
  const TOTAL_SUPPLY_BN = BN(TOTAL_SUPPLY);
  const TOTAL_SUPPLY_BN_WEI = TOTAL_SUPPLY_BN.mul(BN(10).pow(DECIMAL_BN));
  const TXN_LIMIT_BN_WEI = BN(TXN_LIMIT).mul(BN(10).pow(DECIMAL_BN));
  const WALLET_BALANCE_LIMIT_BN_WEI = BN(WALLET_BALANCE_LIMIT).mul(BN(10).pow(DECIMAL_BN));

  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners();

    const MyToken = await ethers.getContractFactory('MyToken');

    token = await upgrades.deployProxy(MyToken, [
      NAME,
      SYMBOL,
      TOTAL_SUPPLY_BN_WEI,
      DECIMALS,
      owner.address,
      TXN_LIMIT_BN_WEI,
      WALLET_BALANCE_LIMIT_BN_WEI,
      ANTI_BOT_PROTECTION,
    ]);
  });

  describe('Toggling Anti-Bot Protection', () => {
    it('Anti-Bot protection is set on deployment', async () => {
      expect(await token.getAntiBotProtectionStatus()).to.equal(ANTI_BOT_PROTECTION);
    });

    it('Anti-Bot Protection can be enabled by owner', async () => {
      await expect(token.toggleAntiBotProtection(true)).not.to.be.reverted;

      expect(await token.getAntiBotProtectionStatus()).to.be.true;
    });

    it('Anti-Bot Protection can be disabled by owner', async () => {
      await expect(token.toggleAntiBotProtection(false)).not.to.be.reverted;

      expect(await token.getAntiBotProtectionStatus()).to.be.false;
    });

    it('Should revert if other than owner is trying to enable or disable Anti-Bot protection', async () => {
      await expect(token.connect(user1).toggleAntiBotProtection(false)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Should emit event when Anti-Bot Protection status is changed', async () => {
      await expect(token.toggleAntiBotProtection(false))
        .to.emit(token, 'AntiBotProtectionUpdated')
        .withArgs(false);
      expect(await token.getAntiBotProtectionStatus()).to.be.false;
    });
  });

  describe('Whitelisting', () => {
    it('Owner address and Contract address is whitelisted by default', async () => {
      expect(await token.isWhiteListed(owner.address)).to.be.true;
      expect(await token.isWhiteListed(token.address)).to.be.true;
    });

    it('Owner can add accounts to whitelist', async () => {
      expect(await token.isWhiteListed(user1.address)).to.be.false;
      await token.addToWhiteList([user1.address]);
      expect(await token.isWhiteListed(user1.address)).to.be.true;
    });

    it('Owner can remove accounts from whitelist', async () => {
      await token.addToWhiteList([user1.address]);
      expect(await token.isWhiteListed(user1.address)).to.be.true;
      await token.removeFromWhiteList([user1.address]);
      expect(await token.isWhiteListed(user1.address)).to.be.false;
    });
    it('Should revert if other than owner trying to add or remove accounts from whitelist', async () => {
      await token.addToWhiteList([user1.address]);
      await expect(token.connect(user1).addToWhiteList([user2.address])).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
      await expect(token.connect(user1).removeFromWhiteList([user2.address])).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Users can check an account is whitelisted or not', async () => {
      expect(await token.connect(user1).isWhiteListed(user1.address)).to.be.false;
      await token.addToWhiteList([user1.address]);
      expect(await token.connect(user2).isWhiteListed(user1.address)).to.be.true;
    });

    it('Whitelisted accounts can do transactions', async () => {
      const amountToSendBN = BN(10).mul(BN(10).pow(DECIMAL_BN));
      await token.addToWhiteList([user1.address, user2.address]);

      await token.transfer(user1.address, amountToSendBN);
      await expect(token.connect(user1).transfer(user2.address, amountToSendBN))
        .to.emit(token, 'Transfer')
        .withArgs(user1.address, user2.address, amountToSendBN);

      expect((await token.balanceOf(user2.address)).eq(amountToSendBN)).is.true;
    });

    it('Non whitelisted accounts cannot make transaction', async () => {
      const amountToSendBN = BN(10).mul(BN(10).pow(DECIMAL_BN));
      await token.addToWhiteList([user1.address]);

      await token.transfer(user1.address, amountToSendBN);

      await expect(token.connect(user1).transfer(user2.address, amountToSendBN)).to.be.revertedWith(
        'Transactions disabled for these accounts.'
      );
    });

    it('Should emit event when an address is whitelisted.', async () => {
      await expect(token.addToWhiteList([user1.address, user2.address]))
        .to.emit(token, 'WhiteListUpdated')
        .withArgs(true, [user1.address, user2.address]);
    });

    it('Should not whitelist zero address.', async () => {
      await token.addToWhiteList([user1.address, ZERO_ADDRESS, user2.address]);
      expect(await token.isWhiteListed(ZERO_ADDRESS)).to.be.false;
    });

    it('Should emit event when an address is removed from whitelist.', async () => {
      await expect(token.removeFromWhiteList([user1.address, user2.address]))
        .to.emit(token, 'WhiteListUpdated')
        .withArgs(false, [user1.address, user2.address]);
    });
  });

  describe('Transaction Limit', () => {
    it('Owner can update transaction limit', async () => {
      const NEW_TXN_LIMIT_BN_WEI = BN(10).mul(BN(10).pow(DECIMAL_BN));

      expect((await token.getTransactionLimit()).eq(TXN_LIMIT_BN_WEI)).is.true;

      await token.setTransactionLimit(NEW_TXN_LIMIT_BN_WEI);
      expect((await token.getTransactionLimit()).eq(NEW_TXN_LIMIT_BN_WEI)).is.true;
    });

    it('Should revert if other than owner trying to update transaction limit', async () => {
      const NEW_TXN_LIMIT_BN_WEI = BN(10).mul(BN(10).pow(DECIMAL_BN));
      await token.addToWhiteList([user1.address, user2.address]);
      expect(await token.isWhiteListed(user1.address)).to.be.true;
      expect(await token.isWhiteListed(user1.address)).to.be.true;
      expect((await token.getTransactionLimit()).eq(TXN_LIMIT_BN_WEI)).is.true;
      await expect(
        token.connect(user1).setTransactionLimit(NEW_TXN_LIMIT_BN_WEI)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Transactions allowed under specific limit', async () => {
      const amountToSendBN = BN(10).mul(BN(10).pow(DECIMAL_BN));
      await token.addToWhiteList([user1.address, user2.address]);

      expect(await token.isWhiteListed(user1.address)).to.be.true;
      await token.setTransactionLimit(TXN_LIMIT_BN_WEI);
      expect((await token.getTransactionLimit()).eq(TXN_LIMIT_BN_WEI)).is.true;
      expect(amountToSendBN.lte(TXN_LIMIT_BN_WEI)).is.true;

      await token.transfer(user1.address, amountToSendBN);
      await expect(token.connect(user1).transfer(user2.address, amountToSendBN))
        .to.emit(token, 'Transfer')
        .withArgs(user1.address, user2.address, amountToSendBN);

      expect((await token.balanceOf(user2.address)).eq(amountToSendBN)).is.true;
    });

    it('Transactions are reverted if the amount is above specific limit', async () => {
      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMAL_BN));

      await token.addToWhiteList([user1.address, user2.address]);
      expect(await token.isWhiteListed(user1.address)).to.be.true;
      expect(await token.isWhiteListed(user2.address)).to.be.true;

      await token.setTransactionLimit(TXN_LIMIT_BN_WEI, {
        from: owner.address,
      });
      expect((await token.getTransactionLimit()).eq(TXN_LIMIT_BN_WEI)).is.true;

      expect(amountToSendBN.gte(TXN_LIMIT_BN_WEI)).is.true;
      await expect(token.connect(user1).transfer(user2.address, amountToSendBN)).to.be.revertedWith(
        'Transaction limit exceeded : Please send lesser amounts.'
      );
    });

    it('Should emit event when transaction limit is set.', async () => {
      await expect(token.connect(owner).setTransactionLimit(TXN_LIMIT_BN_WEI))
        .to.emit(token, 'MaximumTransactionLimitUpdated')
        .withArgs(TXN_LIMIT_BN_WEI);
      expect((await token.getTransactionLimit()).eq(TXN_LIMIT_BN_WEI)).is.true;
    });
  });

  describe('Maximum Wallet Balance', () => {
    it('Owner can update maximum wallet balance limit', async () => {
      const NEW_WALLET_BALANCE_LIMIT_BN_WEI = BN(100).mul(BN(10).pow(DECIMAL_BN));

      expect((await token.getWalletBalanceLimit()).eq(WALLET_BALANCE_LIMIT_BN_WEI)).is.true;

      await token.setWalletBalanceLimit(NEW_WALLET_BALANCE_LIMIT_BN_WEI);
      expect((await token.getWalletBalanceLimit()).eq(NEW_WALLET_BALANCE_LIMIT_BN_WEI)).is.true;
    });

    it('Should revert if other than owner trying to update maximum wallet balance limit', async () => {
      const NEW_WALLET_BALANCE_LIMIT_BN_WEI = BN(100).mul(BN(10).pow(DECIMAL_BN));

      await token.addToWhiteList([user1.address, user2.address]);
      expect((await token.getWalletBalanceLimit()).eq(WALLET_BALANCE_LIMIT_BN_WEI)).is.true;

      await expect(
        token.connect(user1).setWalletBalanceLimit(NEW_WALLET_BALANCE_LIMIT_BN_WEI)
      ).to.be.revertedWith('Ownable: caller is not the owner');
      expect((await token.getWalletBalanceLimit()).eq(NEW_WALLET_BALANCE_LIMIT_BN_WEI)).is.false;
      expect((await token.getWalletBalanceLimit()).eq(WALLET_BALANCE_LIMIT_BN_WEI)).is.true;
    });

    it('Transactions are allowed if balance does not exceed limit', async () => {
      const amountToSendBN = BN(10).mul(BN(10).pow(DECIMAL_BN));

      await token.addToWhiteList([user1.address, user2.address]);
      expect(await token.isWhiteListed(user1.address)).to.be.true;
      expect(await token.isWhiteListed(user2.address)).to.be.true;

      await token.setWalletBalanceLimit(WALLET_BALANCE_LIMIT_BN_WEI);
      expect((await token.getWalletBalanceLimit()).eq(WALLET_BALANCE_LIMIT_BN_WEI)).is.true;

      expect((await token.balanceOf(user1.address)).eq(BN(0))).is.true;
      expect(amountToSendBN.lte(WALLET_BALANCE_LIMIT_BN_WEI)).is.true;

      await token.transfer(user1.address, amountToSendBN);
      await expect(token.connect(user1).transfer(user2.address, amountToSendBN))
        .to.emit(token, 'Transfer')
        .withArgs(user1.address, user2.address, amountToSendBN);

      expect((await token.balanceOf(user2.address)).eq(amountToSendBN)).is.true;
    });

    it('Transactions are reverted if balance exceed limit', async () => {
      const amountToSendBN = BN(100).mul(BN(10).pow(DECIMAL_BN));

      await token.addToWhiteList([user1.address, user2.address]);
      expect(await token.isWhiteListed(user1.address)).to.be.true;

      await token.setWalletBalanceLimit(WALLET_BALANCE_LIMIT_BN_WEI);
      expect((await token.getWalletBalanceLimit()).eq(WALLET_BALANCE_LIMIT_BN_WEI)).is.true;

      expect((await token.balanceOf(user1.address)).eq(BN(0))).is.true;
      await token.transfer(user1.address, amountToSendBN);
      await token.transfer(user2.address, amountToSendBN);
      await expect(token.connect(user1).transfer(user2.address, amountToSendBN)).to.be.revertedWith(
        'Exceeding maximum wallet balance : Please send lesser amounts.'
      );
    });

    it('Should emit event when wallet balance limit is set.', async () => {
      await expect(token.setWalletBalanceLimit(WALLET_BALANCE_LIMIT_BN_WEI))
        .to.emit(token, 'MaximumWalletBalanceUpdated')
        .withArgs(WALLET_BALANCE_LIMIT_BN_WEI);
      expect((await token.getWalletBalanceLimit()).eq(WALLET_BALANCE_LIMIT_BN_WEI)).is.true;
    });
  });
});
