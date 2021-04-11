const fs = require('fs');
var web3 = require('web3')
const Tx = require('ethereumjs-tx').Transaction

function CustomException(message) {
  const error = new Error(message);
  return error;
}

CustomException.prototype = Object.create(Error.prototype);

class Web3Controller {
  constructor(configFilePath,network) {
    try {
      this.configFile = require(configFilePath).networks[network]
      if(this.configFile == undefined) throw new CustomException(`Network:${network}, is a unknown network! Network:${network}, not configured in config file`)
      this.network = network;
      this.web3 = new web3(configFilePath.url);
      this.web3.setProvider(new web3.providers.HttpProvider(this.configFile.url))
      this.contract = this.createContract()
    }catch(e){
      console.log(e);
    }
  }

  getAbi(){
    return new Promise((resolve,reject)=>{
      fs.readFile(this.configFile.abiPath,'utf8', (error,data)=>{
         if(error){
           console.log(error);
         }else{
           resolve(data)
         }
      });
    });
  }

  createContract(){
    return new Promise(async (resolve, reject)=>{
      var abi = JSON.parse(await this.getAbi()).abi
      var contract = new this.web3.eth.Contract(abi,this.configFile.contractAddress);
      resolve(contract);
    });
  }

  callMethod(funcName,args = null){
    return new Promise(async (resolve,reject)=>{
      try{
        var contract = await this.contract
        if(args != null){
          var result = contract.methods[funcName](...args).call();
          resolve(result)
        }else{
          var result = contract.methods[funcName]().call();
          resolve(result)
        }
      }catch(e){
        console.log(e);
        reject(e)
      }

    });
  }

  getMethodAbi(methodName,args){

    return new Promise(async (resolve, reject) => {
      var contract = await this.contract
      var contractFunc = contract.methods[methodName](...args);
      var contractFuncAbi = contractFunc.encodeABI();
      resolve(contractFuncAbi);

    });
  }

  createTransactionObject(_to,_from,_data) {
    const txData = {
      gasPrice: this.web3.utils.toHex(10e9),
      gasLimit: this.web3.utils.toHex(2500000),
      to: _to,
      from: _from,
      data: _data
    }
    return txData
  }

  sendRawTransaction(_to,_from,_data,_chainId){
    return new Promise(async (resolve,reject)=>{
      var txData = this.createTransactionObject(_to, _from, _data);
      var count = await this.web3.eth.getTransactionCount(_from)
      const nonce = this.web3.utils.toHex(count)
      const transaction = new Tx({ ...txData, nonce: nonce }, { chain: _chainId }) // or 'rinkeby'
      transaction.sign(Buffer.from(this.configFile.privateKey, 'hex'))
      const serializedTx = transaction.serialize().toString('hex')
      var result = this.web3.eth.sendSignedTransaction('0x' + serializedTx)
      resolve(result);
    });
  }

  callStateChangingMethod(from,methodName,args){
    return new Promise(async (resolve,reject)=>{
      var contract = await this.contract
      var methodAbi = await this.getMethodAbi(methodName, args);
      var result = await this.sendRawTransaction(this.configFile.contractAddress,from,methodAbi,"kovan");
      resolve(result);
    });
  }

  getEvent(event,fromBlock,toBlock){
    return new Promise(async (resolve,reject)=>{
      var contract = await this.contract
      contract.getPastEvents(event,
      {
          fromBlock: fromBlock,
          toBlock: toBlock
      }).then(events => resolve(events))
    });
  }

}



module.exports = Web3Controller
