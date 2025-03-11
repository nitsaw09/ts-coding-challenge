import { Given, Then, When } from "@cucumber/cucumber";
import {
  AccountBalanceQuery,
  AccountId,
  Client,
  PrivateKey,
  RequestType,
  TopicCreateTransaction,
  TopicInfoQuery,
  TopicMessageQuery,
  TopicMessageSubmitTransaction,
  TopicId,
  KeyList
} from "@hashgraph/sdk";
import { accounts } from "../../src/config";
import assert from "node:assert";
import ConsensusSubmitMessage = RequestType.ConsensusSubmitMessage;

// Pre-configured client for test network (testnet)
const client = Client.forTestnet()

//Set the operator with the account ID and private key
Given(/^a first account with more than (\d+) hbars$/, async function (expectedBalance: number) {
  const acc = accounts[0]
  const account: AccountId = AccountId.fromString(acc.id);
  this.account = account
  const privKey: PrivateKey = PrivateKey.fromStringED25519(acc.privateKey);
  this.privKey = privKey
  client.setOperator(this.account, privKey);

  //Create the query request
  const query = new AccountBalanceQuery().setAccountId(account);
  const balance = await query.execute(client)
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance)
});

When(/^A topic is created with the memo "([^"]*)" with the first account as the submit key$/, async function (memo: string) {
    // Create a new topic
    const transaction = new TopicCreateTransaction()
    .setTopicMemo(memo)
    .setSubmitKey(this.privKey?.publicKey);

    // Sign with the client operator private key and submit the transaction to a Hedera network
    const txResponse = await transaction.execute(client);

    // Get the receipt
    const receipt = await txResponse.getReceipt(client);

    // Get the topic ID
    this.topicId = receipt.topicId;

    // Log the topic ID for debugging
    console.log(`Created topic with ID: ${this.topicId}`);

    // Verify topic was created with the correct memo
    const topicInfo = await new TopicInfoQuery()
    .setTopicId(this.topicId)
    .execute(client);

    assert.strictEqual(topicInfo.topicMemo, memo);
});

When(/^The message "([^"]*)" is published to the topic$/, async function (message: string) {
    // Create the transaction
    const transaction = new TopicMessageSubmitTransaction()
    .setTransactionMemo("Taxi rides")
    .setTopicId(this.topicId)
    .setMessage(message);

    // Sign with the client operator private key and submit to a Hedera network
    const txResponse = await transaction.execute(client);

    // Get the receipt
    const receipt = await txResponse.getReceipt(client);
    
    // Store the transaction ID for verification
    this.messageTransactionId = txResponse.transactionId;

    // Log for debugging
    console.log(`Published message to topic ${this.topicId}`);
    console.log(`Transaction ID: ${this.messageTransactionId.toString()}`);
});

Then(/^The message "([^"]*)" is received by the topic and can be printed to the console$/, async function (message: string) {
    // Allow a delay for the message to be processed
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Create a query to get messages from the topic
  const query: any = new TopicMessageQuery()
    .setTopicId(this.topicId)
    .setLimit(0);

    const subscription = query.subscribe(client, (msg: any) => {
        // Convert the message to a string
        const receivedMessage = Buffer.from(msg.contents).toString();
        console.log(`Received message: ${receivedMessage}`);
        
        // Check if this is the message we're looking for
        if (receivedMessage === message) {
          console.log(`✓ Message "${message}" found in topic!`);
        }
    });
});

Given(/^A second account with more than (\d+) hbars$/, async function (expectedBalance: number) {
  const acc = accounts[1];
  const account: AccountId = AccountId.fromString(acc.id);
  this.account = account
  const privKey: PrivateKey = PrivateKey.fromStringED25519(acc.privateKey);
  this.privKey = privKey
  client.setOperator(this.account, privKey);

  //Create the query request
  const query = new AccountBalanceQuery().setAccountId(account);
  const balance = await query.execute(client)
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance)
});

Given(/^A (\d+) of (\d+) threshold key with the first and second account$/, async function (threshold: number, total: number) {
    // Create a list with public keys from both accounts
    const publicKeyList = [
      this.privKey?.publicKey,
      this.secondPrivKey?.publicKey
    ];
    
    // Create a KeyList with threshold parameter
    this.thresholdKey = new KeyList(publicKeyList, threshold);
    
    // Log for debugging
    console.log(`Created ${threshold} of ${total} threshold key: ${this.thresholdKey}`);
});

When(/^A topic is created with the memo "([^"]*)" with the threshold key as the submit key$/, async function (memo: string) {
    // Create a new topic with the threshold key as the submit key
    const transaction = new TopicCreateTransaction()
        .setSubmitKey(this.thresholdKey?.publicKey) 
        .setTopicMemo(memo)
        .freezeWith(client);
        
    const txResponse = await transaction.execute(client);
    
    // Get the receipt
    const receipt = await txResponse.getReceipt(client);
    
    // Get the topic ID
    this.topicId = receipt.topicId;
    
    // Log the topic ID for debugging
    console.log(`Created topic with threshold key. Topic ID: ${this.topicId}`);
    
    // Verify the topic was created with the correct memo
    const topicInfo = await new TopicInfoQuery()
      .setTopicId(this.topicId)
      .execute(client);
    assert.strictEqual(topicInfo.topicMemo, memo);
  });