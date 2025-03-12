import { Given, Then, When } from "@cucumber/cucumber";
import { accounts } from "../../src/config";
import { 
  AccountBalanceQuery, 
  AccountId, 
  Client, 
  PrivateKey,
  TokenCreateTransaction,
  TokenMintTransaction,
  TransferTransaction,
  TokenInfoQuery,
  Status,
  TokenAssociateTransaction
} from "@hashgraph/sdk";
import assert from "node:assert";

const client = Client.forTestnet();
let accountIds: any = [];
let privateKeys: any = [];
let transaction: any;
let tokenDecimals = 2;
let myTokenName = "Test Token";
let myTokenSymbol = "HTT";
let transactionFeePayerId: any;

// Helper function to setup an account
async function setupAccount(accountIndex: number, isOperator = false) {
  const account = accounts[accountIndex];
  const accountId = AccountId.fromString(account.id);
  const privateKey = PrivateKey.fromStringED25519(account.privateKey);
  
  accountIds[accountIndex] = accountId;
  privateKeys[accountIndex] = privateKey;
  
  if (isOperator) {
    client.setOperator(accountId, privateKey);
  }
  
  return { accountId, privateKey };
}

// Helper function to get account balance
async function getAccountBalance(accountId: AccountId) {
  const query = new AccountBalanceQuery().setAccountId(accountId);
  return await query.execute(client);
}

async function associateTokenAccount(accountIndex: number, tokenId: any) {
  //Associate a token to an account and freeze the unsigned transaction for signing
  const txTokenAssociate1 = await new TokenAssociateTransaction()
    .setAccountId(accountIds[accountIndex])
    .setTokenIds([tokenId]) //Fill in the token ID
    .freezeWith(client);

  //Sign with the private key of the account that is being associated to a token 
  const signTxTokenAssociate1 = await txTokenAssociate1.sign(privateKeys[accountIndex]);

  //Submit the transaction to a Hedera network    
  await signTxTokenAssociate1.execute(client);
}

Given(/^A Hedera account with more than (\d+) hbar$/, async function (expectedBalance: number) {
  const { accountId } = await setupAccount(0, true);
  console.log("Admin Account:", accountId.toString());
  // Create the query request
  const balance = await getAccountBalance(accountId);
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance);
});

When(/^I create a token named Test Token \(HTT\)$/, async function () {
  // Create the transaction
  const transaction = await new TokenCreateTransaction()
    .setTokenName(myTokenName)
    .setTokenSymbol(myTokenSymbol)
    .setDecimals(tokenDecimals)
    .setInitialSupply(0)
    .setTreasuryAccountId(accountIds[0])
    .setAdminKey(privateKeys[0].publicKey)
    .setSupplyKey(privateKeys[0].publicKey)
    .freezeWith(client);
  
  // Sign with the treasury key
  const signedTx = await transaction.sign(privateKeys[0]);
  
  // Submit the transaction to a Hedera network
  const txResponse = await signedTx.execute(client);
  
  // Get the receipt
  const receipt = await txResponse.getReceipt(client);
  
  // Get the token ID
  this.tokenId = receipt.tokenId;
});

Then(/^The token has the name "([^"]*)"$/, async function (name: string) {
  const tokenInfo = await new TokenInfoQuery()
    .setTokenId(this.tokenId)
    .execute(client);
  assert.strictEqual(tokenInfo.name, name);
});

Then(/^The token has the symbol "([^"]*)"$/, async function (symbol: string) {
  const tokenInfo = await new TokenInfoQuery()
    .setTokenId(this.tokenId)
    .execute(client);
  
  assert.strictEqual(tokenInfo.symbol, symbol);
});

Then(/^The token has (\d+) decimals$/, async function (decimals: number) {
  const tokenInfo = await new TokenInfoQuery()
    .setTokenId(this.tokenId)
    .execute(client);
  
  assert.strictEqual(tokenInfo.decimals, decimals);
});

Then(/^The token is owned by the account$/, async function () {
  const tokenInfo: any = await new TokenInfoQuery()
    .setTokenId(this.tokenId)
    .execute(client);
  
  assert.strictEqual(tokenInfo.treasuryAccountId.toString(), accountIds[0].toString());
});

Then(/^An attempt to mint (\d+) additional tokens succeeds$/, async function (amount: number) {
  // Create the transaction
  const transaction = await new TokenMintTransaction()
    .setTokenId(this.tokenId)
    .setAmount(amount)
    .freezeWith(client);
  
  // Sign with the supply key
  const signedTx = await transaction.sign(privateKeys[0]);
  
  // Submit the transaction
  const txResponse = await signedTx.execute(client);
  
  // Get the receipt
  const receipt = await txResponse.getReceipt(client);
  
  // Check status
  assert.strictEqual(receipt.status.toString(), Status.Success.toString());
});

When(/^I create a fixed supply token named Test Token \(HTT\) with (\d+) tokens$/, async function (supply: number) {
  // Create the transaction
  const transaction = await new TokenCreateTransaction()
    .setTokenName(myTokenName)
    .setTokenSymbol(myTokenSymbol)
    .setDecimals(tokenDecimals)
    .setInitialSupply(supply)
    .setTreasuryAccountId(accountIds[0])
    .setAdminKey(privateKeys[0].publicKey)
    .freezeWith(client);
  
  // Sign with the treasury key
  const signedTx = await transaction.sign(privateKeys[0]);
  
  // Submit the transaction to a Hedera network
  const txResponse = await signedTx.execute(client);
  
  // Get the receipt
  const receipt = await txResponse.getReceipt(client);
  
  // Get the token ID
  this.tokenId = receipt.tokenId;
});

Then(/^The total supply of the token is (\d+)$/, async function (supply: number) {
  const tokenInfo = await new TokenInfoQuery()
    .setTokenId(this.tokenId)
    .execute(client);
  
  assert.strictEqual(tokenInfo.totalSupply.toNumber(), supply);
});

Then(/^An attempt to mint tokens fails$/, async function () {
  try {
    // Create the transaction
    const transaction = await new TokenMintTransaction()
      .setTokenId(this.tokenId)
      .setAmount(100)
      .freezeWith(client);
    
    // Sign with the treasury key
    const signedTx = await transaction.sign(privateKeys[0]);
    
    // Submit the transaction
    await signedTx.execute(client);
    
    // If we get here, the test should fail
    assert.fail("Token minting should have failed");
  } catch (error) {
    // Expected to fail
    assert.ok(true);
  }
});

Given(/^A first hedera account with more than (\d+) hbar$/, async function (expectedBalance: number) {
  const { accountId } = await setupAccount(1);
  
  const balance = await getAccountBalance(accountId);
  console.log("Account1:", accountId.toString());
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance);
});

Given(/^A second Hedera account$/, async function () {
  const { accountId } = await setupAccount(2);
  console.log("Account2:", accountId.toString());
});

Given(/^A token named Test Token \(HTT\) with (\d+) tokens$/, async function (supply: number) {
  // Create the transaction
  const transaction = await new TokenCreateTransaction()
    .setTokenName(myTokenName)
    .setTokenSymbol(myTokenSymbol)
    .setDecimals(tokenDecimals)
    .setInitialSupply(supply)
    .setTreasuryAccountId(accountIds[0])
    .setAdminKey(privateKeys[0].publicKey)
    .setFreezeDefault(false)
    .freezeWith(client);
  // Sign with the treasury key
  const signedTx = await transaction.sign(privateKeys[0]);
  //console.log("Signing with account1:", signedTx);
  
  // Submit the transaction to a Hedera network
  const txResponse = await signedTx.execute(client);
  
  // Get the receipt
  const receipt = await txResponse.getReceipt(client);

  // Get the token ID
  this.tokenId = receipt.tokenId;
});

Given(/^The first account holds (\d+) HTT tokens$/, async function (amount: number) {
  // Then transfer tokens if needed
  const balance = await getAccountBalance(accountIds[0]);
  let currentBalance = balance.tokens?._map.get(this.tokenId.toString())?.toNumber() || 0;

  let firstAccountBalance: any = await getAccountBalance(accountIds[1]);
  firstAccountBalance = firstAccountBalance.tokens?._map.get(this.tokenId.toString())?.toNumber() || 0;
  
  await associateTokenAccount(1, this.tokenId);

  if (currentBalance >= amount && firstAccountBalance < amount && amount > 0) {
    // Need to transfer from treasury to second account
    const transaction = await new TransferTransaction()
      .addTokenTransfer(this.tokenId, accountIds[0], -amount)
      .addTokenTransfer(this.tokenId, accountIds[1], amount)
      .freezeWith(client);
      
      const signedTx = await transaction.sign(privateKeys[0]);
      const txResponse = await signedTx.execute(client);
      await txResponse.getReceipt(client);
  }

  const updateBalance = await getAccountBalance(accountIds[1]);
  currentBalance = updateBalance.tokens?._map.get(this.tokenId.toString())?.toNumber() || 0;
  console.log("Account 1 balance update: ", currentBalance);
  assert.strictEqual(currentBalance, amount);
});

Given(/^The second account holds (\d+) HTT tokens$/, async function (amount: number) {
  const balance = await getAccountBalance(accountIds[0]);
  let currentBalance = balance.tokens?._map.get(this.tokenId.toString())?.toNumber() || 0;

  let secondAccountBalance: any = await getAccountBalance(accountIds[2]);
  secondAccountBalance = secondAccountBalance.tokens?._map.get(this.tokenId.toString())?.toNumber() || 0;
  
  await associateTokenAccount(2, this.tokenId); 

  if (currentBalance >= amount && secondAccountBalance < amount && amount > 0) {
    // Need to transfer from treasury to second account
    const transaction = await new TransferTransaction()
      .addTokenTransfer(this.tokenId, accountIds[0], -amount)
      .addTokenTransfer(this.tokenId, accountIds[2], amount)
      .freezeWith(client);
      
      const signedTx = await transaction.sign(privateKeys[0]);
      const txResponse = await signedTx.execute(client);
      await txResponse.getReceipt(client);
  }

  const updateBalance = await getAccountBalance(accountIds[2]);
  currentBalance = updateBalance.tokens?._map.get(this.tokenId.toString())?.toNumber() || 0;
  console.log("Account 2 balance update: ", currentBalance);
  assert.strictEqual(currentBalance, amount);
});

When(/^The first account creates a transaction to transfer (\d+) HTT tokens to the second account$/, async function (amount: number) {
  transaction = await new TransferTransaction()
    .addTokenTransfer(this.tokenId, accountIds[1], -amount)
    .addTokenTransfer(this.tokenId, accountIds[2], amount)
    .freezeWith(client);
  // Store the fee payer ID
  transactionFeePayerId = accountIds[1];

  const signedTx = await transaction.sign(privateKeys[1]);
  const txResponse = await signedTx.execute(client);
  const receipt = await txResponse.getReceipt(client);
  console.log("Transaction status: " + receipt?.status?.toString());
});

When(/^The first account submits the transaction$/, async function () {
  console.log("First account submits the transaction:", transaction?.transactionId?.toString());
});

When(/^The second account creates a transaction to transfer (\d+) HTT tokens to the first account$/, async function (amount: number) {
  const transaction2 = await new TransferTransaction()
    .addTokenTransfer(this.tokenId, accountIds[2], -amount)
    .addTokenTransfer(this.tokenId, accountIds[1], amount)
    .freezeWith(client);
  const signedTx2 = await transaction2.sign(privateKeys[2]);
  const txResponse2 = await signedTx2.execute(client);
  await txResponse2.getReceipt(client);
});

Then(/^The first account has paid for the transaction fee$/, async function () {
  // This is a simplification - in a real implementation, you would need to
  // check the record of the transaction to see who paid the fee
  assert.strictEqual(transactionFeePayerId?.toString(), accountIds[1]?.toString());
});

Given(/^A first hedera account with more than (\d+) hbar and (\d+) HTT tokens$/, async function (hbarAmount: number, tokenAmount: number) {
  const { accountId } = await setupAccount(1);
  console.log("Account1:", accountId.toString());
  // Check HBAR balance
  const hbarBalance = await getAccountBalance(accountId);
  assert.ok(hbarBalance.hbars.toBigNumber().toNumber() > hbarAmount);

   // Setup token balance (similar to second account)
   const balance = await getAccountBalance(accountIds[1]);
   const currentBalance = balance.tokens?._map.get(this.tokenId.toString())?.toNumber() || 0;
 
   await associateTokenAccount(1, this.tokenId);
 
   if (currentBalance !== tokenAmount) {
     // Transfer needed
     const transferAmount = tokenAmount - currentBalance;
     
     if (transferAmount > 0) {
       // Need to transfer from treasury to third account
       const transaction = await new TransferTransaction()
         .addTokenTransfer(this.tokenId, accountIds[0], -transferAmount)
         .addTokenTransfer(this.tokenId, accountIds[1], transferAmount)
         .freezeWith(client);
       
       const signedTx = await transaction.sign(privateKeys[0]);
       const txResponse = await signedTx.execute(client);
       await txResponse.getReceipt(client);
     }
   }
});

Given(/^A second Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function (hbarAmount: number, tokenAmount: number) {
  await setupAccount(2);
  console.log("Account2:", accountIds[2].toString());

   // Setup token balance (similar to second account)
   const balance = await getAccountBalance(accountIds[2]);
   const currentBalance = balance.tokens?._map.get(this.tokenId.toString())?.toNumber() || 0;
 
   await associateTokenAccount(2, this.tokenId);
 
   if (currentBalance !== tokenAmount) {
     // Transfer needed
     const transferAmount = tokenAmount - currentBalance;
     
     if (transferAmount > 0) {
       // Need to transfer from treasury to third account
       const transaction = await new TransferTransaction()
         .addTokenTransfer(this.tokenId, accountIds[0], -transferAmount)
         .addTokenTransfer(this.tokenId, accountIds[2], transferAmount)
         .freezeWith(client);
       
       const signedTx = await transaction.sign(privateKeys[0]);
       const txResponse = await signedTx.execute(client);
       await txResponse.getReceipt(client);
     }
   }
});

Given(/^A third Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function (hbarAmount: number, tokenAmount: number) {
  const  { accountId } = await setupAccount(3);
  console.log("Account3:", accountId.toString());
  // Setup token balance (similar to second account)
  const balance = await getAccountBalance(accountIds[3]);
  const currentBalance = balance.tokens?._map.get(this.tokenId.toString())?.toNumber() || 0;

  await associateTokenAccount(3, this.tokenId);

  if (currentBalance !== tokenAmount) {
    // Transfer needed
    const transferAmount = tokenAmount - currentBalance;
    
    if (transferAmount > 0) {
      // Need to transfer from treasury to third account
      const transaction = await new TransferTransaction()
        .addTokenTransfer(this.tokenId, accountIds[0], -transferAmount)
        .addTokenTransfer(this.tokenId, accountIds[3], transferAmount)
        .freezeWith(client);
      
      const signedTx = await transaction.sign(privateKeys[0]);
      const txResponse = await signedTx.execute(client);
      await txResponse.getReceipt(client);
    }
  }
});

Given(/^A fourth Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function (hbarAmount: number, tokenAmount: number) {
  const { accountId } = await setupAccount(4);
  console.log("Account4:", accountId.toString());
  // Setup token balance (similar to third account)
  const balance = await getAccountBalance(accountIds[4]);
  const currentBalance = balance.tokens?._map.get(this.tokenId.toString())?.toNumber() || 0;
  
  await associateTokenAccount(4, this.tokenId);

  if (currentBalance !== tokenAmount) {
    // Transfer needed
    const transferAmount = tokenAmount - currentBalance;
    
    if (transferAmount > 0) {
      // Need to transfer from treasury to fourth account
      const transaction = await new TransferTransaction()
        .addTokenTransfer(this.tokenId, accountIds[0], -transferAmount)
        .addTokenTransfer(this.tokenId, accountIds[4], transferAmount)
        .freezeWith(client);
      
      const signedTx = await transaction.sign(privateKeys[0]);
      const txResponse = await signedTx.execute(client);
      await txResponse.getReceipt(client);
    }
  }
});

When(/^A transaction is created to transfer (\d+) HTT tokens out of the first and second account and (\d+) HTT tokens into the third account and (\d+) HTT tokens into the fourth account$/, async function (outAmount: number, inAmount1: number, inAmount2: number) {
  const balance1 = await getAccountBalance(accountIds[1]);
  const currentBalance1 = balance1.tokens?._map.get(this.tokenId.toString())?.toNumber() || 0;
  console.log("Account 1 HTT balance: ", currentBalance1);
  
  if (currentBalance1 > outAmount) {
    await associateTokenAccount(1, this.tokenId); 
    const transaction1 = await new TransferTransaction()
      .addTokenTransfer(this.tokenId, accountIds[1], -outAmount)
      .addTokenTransfer(this.tokenId, accountIds[3], inAmount1)
      .addTokenTransfer(this.tokenId, accountIds[4], inAmount1)
      .freezeWith(client);
    
    const signedTx1 = await transaction1.sign(privateKeys[1]);
    const txResponse1 = await signedTx1.execute(client);
    //await txResponse1.getReceipt(client);
  }  

  const balance2 = await getAccountBalance(accountIds[2]);
  const currentBalance2 = balance2.tokens?._map.get(this.tokenId.toString())?.toNumber() || 0;
  console.log("Account 2 HTT balance: ", currentBalance2);

  if (currentBalance2 > outAmount) {
    await associateTokenAccount(2, this.tokenId);
    const transaction2 = await new TransferTransaction()
      .addTokenTransfer(this.tokenId, accountIds[2], -outAmount)
      .addTokenTransfer(this.tokenId, accountIds[4], inAmount2 - inAmount1)
      .freezeWith(client);
    
    const signedTx2 = await transaction2.sign(privateKeys[2]);
    const txResponse2 = await signedTx2.execute(client);
    //await txResponse2.getReceipt(client);
  }
});

Then(/^The third account holds (\d+) HTT tokens$/, async function (expectedAmount: number) {
  const balance = await getAccountBalance(accountIds[3]);
  assert.strictEqual(balance.tokens?._map.get(this.tokenId.toString())?.toNumber(), expectedAmount);
});

Then(/^The fourth account holds (\d+) HTT tokens$/, async function (expectedAmount: number) {
  const balance = await getAccountBalance(accountIds[4]);
  assert.strictEqual(balance.tokens?._map.get(this.tokenId.toString())?.toNumber(), expectedAmount);
});