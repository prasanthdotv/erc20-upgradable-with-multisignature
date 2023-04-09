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

describe('My Token', () => {
  let owner, user1, user2, user3;
  let token;
  const TOTAL_SUPPLY_BN = BN(TOTAL_SUPPLY);
  const DECIMAL_BN = BN(DECIMALS);
  const TOTAL_SUPPLY_BN_WEI = TOTAL_SUPPLY_BN.mul(BN(10).pow(DECIMAL_BN));
  const TXN_LIMIT_BN_WEI = BN(TXN_LIMIT).mul(BN(10).pow(DECIMAL_BN));
  const WALLET_BALANCE_LIMIT_BN_WEI = BN(WALLET_BALANCE_LIMIT).mul(BN(10).pow(DECIMAL_BN));

  beforeEach(async () => {
    [owner, user1, user2, user3] = await ethers.getSigners();

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
    await token.toggleAntiBotProtection(false);
  });

  describe('Deployment', async () => {
    it('Ownership transferred from deployer to owner', async () => {
      const result = await token.owner();
      expect(result).to.equal(owner.address);
    });
  });

  describe('Metadata', () => {
    it('Token metadata is correct', async () => {
      expect(await token.name()).to.equal(NAME);
      expect(await token.symbol()).to.equal(SYMBOL);
      expect(await token.decimals()).to.equals(Number(DECIMALS));
      expect((await token.totalSupply()).eq(TOTAL_SUPPLY_BN_WEI)).is.true;
      expect((await token.getTransactionLimit()).eq(TXN_LIMIT_BN_WEI)).is.true;
      expect((await token.getWalletBalanceLimit()).eq(WALLET_BALANCE_LIMIT_BN_WEI)).is.true;
      expect(await token.getAntiBotProtectionStatus()).is.false;
    });
  });

  describe('Balance', () => {
    it('Users can check their balance', async () => {
      expect((await token.balanceOf(user1.address)).eq(BN(0))).is.true;

      const amountToSendBN = BN(100).mul(BN(10).pow(DECIMAL_BN));
      //admin to user1.address
      await token.transfer(user1.address, amountToSendBN);
      expect((await token.balanceOf(user1.address)).eq(amountToSendBN)).is.true;
    });
  });

  describe('Transfer', () => {
    it('Initial supply minted and transferred to owner', async () => {
      expect((await token.balanceOf(owner.address)).eq(TOTAL_SUPPLY_BN_WEI)).is.true;
    });

    it('Users can transfer tokens to other users', async () => {
      const amountToSendBN = BN(100).mul(BN(10).pow(DECIMAL_BN));
      //admin to user1.address
      await token.transfer(user1.address, amountToSendBN);
      expect((await token.balanceOf(user1.address)).eq(amountToSendBN)).is.true;
      //user1.address to user2.address
      await token.connect(user1).transfer(user2.address, amountToSendBN);
      expect((await token.balanceOf(user2.address)).eq(amountToSendBN)).is.true;
    });

    it('Event emitted when tokens are transferred', async () => {
      const amountToSendBN = BN(100).mul(BN(10).pow(DECIMAL_BN));
      await expect(token.transfer(user1.address, amountToSendBN))
        .to.emit(token, 'Transfer')
        .withArgs(owner.address, user1.address, amountToSendBN);
    });

    it('Reverts if user tries to transfer tokens without enough balance', async () => {
      const amountToSendBN = BN(100).mul(BN(10).pow(DECIMAL_BN));
      await expect(token.connect(user3).transfer(user2.address, amountToSendBN)).to.be.revertedWith(
        'ERC20: transfer amount exceeds balance'
      );
    });

    it('Reverts if user tries to transfer tokens to zero address', async () => {
      const amountToSendBN = BN(10).mul(BN(10).pow(DECIMAL_BN));
      await expect(token.connect(user1).transfer(ZERO_ADDRESS, amountToSendBN)).to.be.revertedWith(
        'ERC20: transfer to the zero address'
      );
    });
  });

  describe('Allowance', () => {
    it('Users can check their allowance', async () => {
      expect((await token.allowance(owner.address, user1.address)).eq(BN(0)));

      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMAL_BN));
      //approving allowance
      await token.approve(user1.address, amountToSendBN);
      //checking allowance
      expect((await token.allowance(owner.address, user1.address)).eq(amountToSendBN));
    });

    it('Approve transfer of available tokens by third-party', async () => {
      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMAL_BN));
      const balanceOfOwner = await token.balanceOf(owner.address);
      const balanceOfUser1 = await token.balanceOf(user1.address);
      const balanceOfUser2 = await token.balanceOf(user2.address);
      //approving allowance
      await token.approve(user1.address, amountToSendBN);
      //checking allowance

      expect((await token.allowance(owner.address, user1.address)).eq(amountToSendBN));
      //verifying transaction of approved tokens
      await token.connect(user1).transferFrom(owner.address, user2.address, amountToSendBN);

      expect((await token.balanceOf(owner.address)).eq(balanceOfOwner.sub(amountToSendBN)));

      expect((await token.balanceOf(user1.address)).eq(balanceOfUser1));

      expect((await token.balanceOf(user2.address)).eq(balanceOfUser2.add(amountToSendBN)));
    });

    it('Event emitted someone approves transfer of available tokens by third-party', async () => {
      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMAL_BN));

      await expect(token.approve(user1.address, amountToSendBN))
        .to.emit(token, 'Approval')
        .withArgs(owner.address, user1.address, amountToSendBN);
    });

    it('Increase allowance', async () => {
      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMAL_BN));
      const increasedAmountBN = BN(500).mul(BN(10).pow(DECIMAL_BN));
      await token.approve(user1.address, amountToSendBN);
      expect((await token.allowance(owner.address, user1.address)).eq(amountToSendBN));
      await token.increaseAllowance(user1.address, increasedAmountBN);
      expect(
        (await token.allowance(owner.address, user1.address)).eq(
          amountToSendBN.add(increasedAmountBN)
        )
      );
    });

    it('Decrease allowance', async () => {
      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMAL_BN));
      const increasedAmountBN = BN(500).mul(BN(10).pow(DECIMAL_BN));
      await token.approve(user1.address, amountToSendBN);
      expect((await token.allowance(owner.address, user1.address)).eq(amountToSendBN));
      await token.increaseAllowance(user1.address, increasedAmountBN);
      expect(
        (await token.allowance(owner.address, user1.address)).eq(
          amountToSendBN.sub(increasedAmountBN)
        )
      );
    });

    it('Revert when trying to approve unavailable tokens by third-party', async () => {
      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMAL_BN));
      //approving allowance
      await token.connect(user1).approve(user2.address, amountToSendBN);
      //checking allowance
      expect((await token.allowance(user1.address, user2.address)).eq(amountToSendBN));
      //verifying transaction of approved tokens
      await expect(
        token.connect(user2).transferFrom(user1.address, user3.address, amountToSendBN)
      ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });

    it('Revert when trying to transfer more than allowed tokens by third-party', async () => {
      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMAL_BN));
      //approving allowance
      await token.approve(user1.address, amountToSendBN);
      //checking allowance
      expect((await token.allowance(owner.address, user1.address)).eq(amountToSendBN));
      //verifying transaction of approved tokens
      await expect(
        token
          .connect(user1)
          .transferFrom(owner.address, user2.address, amountToSendBN.add(BN(1000)))
      ).to.be.revertedWith('ERC20: insufficient allowance');
    });
  });

  describe('Ownership', () => {
    it('Transferring ownership', async () => {
      await token.transferOwnership(user1.address);
      expect(await token.owner()).to.equal(user1.address);
    });

    it('Event emitted on transferring ownership', async () => {
      await expect(token.transferOwnership(user1.address))
        .to.emit(token, 'OwnershipTransferred')
        .withArgs(owner.address, user1.address);
    });

    it('Revert when some user other than owner tries to transfer ownership', async () => {
      await expect(token.connect(user2).transferOwnership(user1.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Renounce ownership', async () => {
      await token.renounceOwnership();
      expect(await token.owner()).to.not.equal(owner.address);
    });

    it('Revert when some user other than owner tries to renounce ownership', async () => {
      await expect(token.connect(user2).renounceOwnership()).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('Burn', () => {
    it('Users can burn their own tokens', async () => {
      const amountToBurnBN = BN(500).mul(BN(10).pow(DECIMAL_BN));
      const ownerInitBalanceBN = await token.balanceOf(owner.address);

      await token.burn(amountToBurnBN);
      expect((await token.balanceOf(owner.address)).eq(ownerInitBalanceBN.sub(amountToBurnBN))).is
        .true;
    });

    it('Reverts when users tries to burn unavailable tokens', async () => {
      const amountToBurnBN = BN(500).mul(BN(10).pow(DECIMAL_BN));
      await expect(token.connect(user1).burn(amountToBurnBN)).to.be.revertedWith(
        'ERC20: burn amount exceeds balance'
      );
    });

    it('Users can burn allowed tokens from another user', async () => {
      const allowanceAmountBN = BN(1000).mul(BN(10).pow(DECIMAL_BN));
      const amountToBurnBN = BN(500).mul(BN(10).pow(DECIMAL_BN));
      const ownerInitBalanceBN = await token.balanceOf(owner.address);
      await token.approve(user1.address, allowanceAmountBN);
      expect((await token.allowance(owner.address, user1.address)).eq(allowanceAmountBN));
      await token.connect(user1).burnFrom(owner.address, amountToBurnBN);
      expect((await token.balanceOf(owner.address)).eq(ownerInitBalanceBN.sub(amountToBurnBN))).is
        .true;
      expect(
        (await token.allowance(owner.address, user1.address)).eq(
          allowanceAmountBN.sub(amountToBurnBN)
        )
      );
    });

    it('Reverts when users tries to burn tokens more than allowed', async () => {
      const allowanceAmountBN = BN(500).mul(BN(10).pow(DECIMAL_BN));
      const amountToBurnBN = BN(1000).mul(BN(10).pow(DECIMAL_BN));
      await token.approve(user1.address, allowanceAmountBN);
      expect((await token.allowance(owner.address, user1.address)).eq(allowanceAmountBN));
      await expect(token.connect(user1).burnFrom(owner.address, amountToBurnBN)).to.be.revertedWith(
        'ERC20: insufficient allowance'
      );
    });
  });

  describe('Pause', () => {
    it('Owner can pause and unpause the contract', async () => {
      expect(await token.paused()).is.false;
      await token.pause();
      expect(await token.paused()).is.true;
      await token.unpause();
      expect(await token.paused()).is.false;
    });

    it('Transactions are not allowed while contract is paused', async () => {
      const amountToSendBN = BN(100).mul(BN(10).pow(DECIMAL_BN));
      expect(await token.paused()).is.false;
      await token.pause();
      await expect(token.transfer(user1.address, amountToSendBN)).to.be.revertedWith(
        'Pausable: paused'
      );
    });
  });
});
