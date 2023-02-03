const Web3 = require('web3')
const web3 = new Web3(process.env.MAINNET_ENDPOINT)
const axios = require('axios')
const { read, write } = require('./storage')

const bridgeABI = require('./contracts/bridge.json')

const contract = new web3.eth.Contract(bridgeABI, "0x5e4861a80b55f035d899f66772117f00fa0e8e7b")


Array.prototype.total = function() {
  let total = 0
  for (let i = 0; i < this.length; i++) {
    total += this[i]
  }
  return total
}

Array.prototype.mean = function() {
  return this.total() / this.length
}

Array.prototype.stddev = function() {
  const mean = this.mean()
  let varianceSum = 0
  for (let j = 0; j < this.length; j++) {
    varianceSum += Math.pow(this[j] - mean, 2)
  }

  return Math.sqrt(varianceSum) / this.length
}

Array.prototype.zScore = function(num) {
  const stddev = this.stddev()
  if (stddev === 0) {
    return 0
  }
  return (num - this.mean()) / stddev
}

let divisor = 100000000
let amounts = []
contract.events.DepositRevealed({
    filter: {},
    fromBlock: 16523905
}).on('data', async function(e){
  const amount = Number(e.returnValues.amount)
  amounts.push(amount)

  const btc = (amount / divisor).toFixed(2)
  console.log(`${btc} BTC to ${e.returnValues.depositor}`)

  if (await read(e.transactionHash)) {
    return
  }

  const z = amounts.zScore(amount)
  if (z < 2) {
    return
  }

  write(e.transactionHash, true)

  const payload = {
    content: `[${btc}](https://etherscan.io/tx/${e.transactionHash}) BTC to `+
      `[${e.returnValues.depositor}](https://etherscan.io/address/${e.returnValues.depositor})`
  }

  axios({
    method: 'post',
    url: process.env.WEBHOOK_URL,
    data: payload
  }).then(function (response) {
    })
    .catch(function (error) {
      console.log(error);
    })

}).on('changed', function(event){
    // remove event from local database
}).on('error', console.error);
