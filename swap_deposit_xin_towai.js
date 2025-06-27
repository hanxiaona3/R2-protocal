import { ethers } from 'ethers';
import { PrivateKeys$25Wallets, PrivateKeys$18Wallets } from '../../util/privateKey.js';
import fs from 'fs'

// import {getTokenBalance} from '../../util/swaptoken.js';
// import RPC from '../../config/runnerRPC-1.json' assert { type: 'json' };
// import bulbaswapWETHABI from '../../config/bulbaswapWETHABI.json' assert { type: 'json' };


import pLimit from 'p-limit';
const CONCURRENCY_LIMIT=10;  //可以设置最大数值，建议别超过10
const bulbaswapWETHABI=[
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            }
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [
            {
                "internalType": "uint8",
                "name": "",
                "type": "uint8"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

//目前只有sep测试网有，等其他测试网开始
const RPC=["https://g.w.lavanet.xyz:443/gateway/sep1/rpc-http/a175064ed506e16c12597b7e8d24d73e"
    // "https://sepolia-rollup.arbitrum.io/rpc",
    // "https://testnet-rpc.plumenetwork.xyz",
    // "https://testnet-rpc.monad.xyz",
    // "https://monad-testnet.drpc.org",
//     "https://bsc-testnet-rpc.publicnode.com",
//     "https://sepolia.base.org"
]

    // "https://rpc.therpc.io/bsc-testnet",
//https://bsc-testnet-rpc.publicnode.com  bsc链
//RPC生成器
const RPC_provider=async(rpc)=>{
    let retries=0;
    let maxRetries=4;
    let provider=null;
    while (retries<maxRetries) {
      try {
          provider= new ethers.JsonRpcProvider(rpc);//设置链接PRC
          return provider;//设置链接PRC
      } catch (error) {
          retries++;
          console.error(`网络provider链接失败，开始尝试第${retries}次`);
          await sleep(2);
      } 
    }
    throw new Error("provider连接失败，达到最大重试次数");
}


  /**
 * 读取 TXT 文件，并去掉每一行中的 \r 字符
 * @param {string} filePath - TXT 文件的路径
 * @returns {Promise<string[]>} - 返回一个包含每一行内容的数组
 */
  function readTxtFile(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject('读取文件出错: ' + err);
                return;
            }
            // 将文件内容按行分割成数组，并去掉每行的 \r 字符
            const lines = data.split('\n').map(line => line.replace(/\r/g, ''));
            resolve(lines);
        });
    });
  }



  /**
   * 钱包发送交易程序，简化程序代码；
   * maxRetries为最大的尝试次数，默认是3次；
   * timeout为最大的时间周期,默认是10s，合约交互时间较长
   */

  async function walletSendtxData(wallet,txData,maxRetries = 4,timeout=50000){
    let retries = 0;
    let success = false;
    while (retries < maxRetries) {
        try {
            const txPromise = wallet.sendTransaction(txData);
            const transactionResponse= await Promise.race([
                txPromise,
                new Promise((_,reject)=>setTimeout(()=>reject(new Error('TimeOut')),timeout))                
            ]);
            const receipt = await transactionResponse.wait();
            if (receipt.status===1) {
              console.log("交易sucess，hash是:",receipt.hash); 
              retries=maxRetries;
              success=true;
            }else{
              throw new Error(`交易hash是failed，从新进行交易`);              
            }
            await sleep(2)         
            return 0;
        } catch (error) {
            console.error(`Error occurred: ${error.message}`);//暂时屏蔽掉错误信息
            retries++;
            // console.error(`开始尝试第${retries}次,${error.message}`);
            console.error(`开始尝试第${retries}次`);
            if(retries >= maxRetries){
              console.log(`尝试${maxRetries}次仍然失败，退出交易`);
              // console.error(`kayakfinance领取测试币发生错误,开始尝试第${retries}次`);
              return 1;
                // throw new Error('Max retries exceeded'); 
            }
            await sleep(1);//等待3s时间
        }         
    }
}

//打乱钱包顺序
function NewPrivatKeys(privateKeys) {
    // 用一个新数组来保存随机取出的数值
    let shuffled_PrivateKeys = [];
  
    // 随机取值直到取完所有数组元素
    while (privateKeys.length > 0) {
        // 生成一个随机索引
        let randomIndex = Math.floor(Math.random() * privateKeys.length);
        // 从原数组中取出随机的元素
        let randomNum = privateKeys[randomIndex];
        // 将取出的元素加入新数组
        shuffled_PrivateKeys.push(randomNum);
        // 从原数组中移除已经取出的元素
        privateKeys.splice(randomIndex, 1);
    }
    // console.log(shuffled_PrivateKeys);
    return shuffled_PrivateKeys;
}
const  sleep = (seconds) => {
    let milliseconds = seconds * 1000;
    return new Promise(resolve => setTimeout(resolve, milliseconds));
};

//16进制数据制造机器，0在前面
function formHexData(string) {
    if (typeof string !== 'string') {
        return '';
        throw new Error('Input must be a string.');
    }
  
    if (string.length > 64) {
        return '';
        throw new Error('String length exceeds 64 characters.');
    }
  
    return '0'.repeat(64 - string.length) + string;
}

const getTokenBalance = async (tokenAddress, tokenContractABI, wallet) => {
    const address = wallet.address;
    const tokenContract = new ethers.Contract(tokenAddress, tokenContractABI, wallet);

    try {
        const decimals = await tokenContract.decimals();        
        const result = await tokenContract.balanceOf(address);     
        const tokenBalance = ethers.formatUnits(result, decimals);
        // let symbol = await tokenContract.symbol();
        return tokenBalance;
    } catch (error) {
        console.error("Error fetching token balance:", error);
        return null; // 或根据需要返回其他值
    }
};

  
const getTokenDecimals = async(tokenAddress, tokenContractABI,wallet) => {
    let tokenContract = new ethers.Contract(tokenAddress,tokenContractABI, wallet);
    let result = await tokenContract.balanceOf(wallet.address);
    let decimals = await tokenContract.decimals();
    return decimals
}


//USDC_R2USD函数，这个是把所有DIS领取的USDC都转化为R2USD代币
async function USDC_R2USD(wallet,Contract_USDC,Contract_R2USD,USDC_amount,USDC_decimal){
    const address=wallet.address;
    console.log(`USDC_R2USD过程。。。。。。。。。。。。。。。。。。`);
    //approve过程
    let txData = {
        to: Contract_USDC, 
        data: `0x095ea7b3${formHexData(Contract_R2USD.substring(2))}ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`,
        value: 0,
    };
    await walletSendtxData(wallet,txData);
    await sleep(3)
    //跨链过程
    txData = {
        to: Contract_R2USD, 
        data: `0x095e7a95${formHexData(address.substring(2))}${formHexData(BigInt(ethers.parseUnits((USDC_amount).toString(),USDC_decimal)).toString(16))}${'0'.repeat(320)}`,
        value: 0,
    };
    await walletSendtxData(wallet,txData);
    await sleep(2)
}

//USDC_R2USD函数
async function stake_R2USD_sR2USD(wallet,stake_R2USD_amount,Contract_R2USD,Contract_sR2USD,R2USD_decimal){
    const address=wallet.address;
    console.log(`stake_R2USD_sR2USD过程。。。。。。。。。。。。。。。。。。`);
    //approve过程
    let txData = {
        to: Contract_R2USD, 
        data: `0x095ea7b3${formHexData(Contract_sR2USD.substring(2))}ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`,
        value: 0,
    };
    await walletSendtxData(wallet,txData);
    await sleep(5)
    //跨链过程
    txData = {
        to: Contract_sR2USD, 
        data: `0x1a5f0f00${formHexData(BigInt(ethers.parseUnits((stake_R2USD_amount).toString(),R2USD_decimal)).toString(16))}${'0'.repeat(320)}`,
        value: 0,
    };
    await walletSendtxData(wallet,txData);
    await sleep(5)
    // R2USD_amount=await getTokenBalance(Contract_R2USD,bulbaswapWETHABI,wallet);//R2USD数量
    // sR2USD_amount=await getTokenBalance(Contract_sR2USD,bulbaswapWETHABI,wallet);//sR2USD数量
    // console.log(`交易后，，，R2USD的数量是${R2USD_amount},sR2USD的数量是${sR2USD_amount}。。。。。。。。。。。。。。`);

}

//USDC_R2USD函数
async function deposit_R2USD_sR2USD(wallet,deposit_amount,Contract_R2USD,Contract_sR2USD,Contract_sR2UR2USD,R2USD_decimal,sR2USD_decimal,sR2UR2USD_decimal){
    const address=wallet.address;
    console.log(`质押_R2USD_sR2USD过程。。。。。。。。。。。。。。。。。。`);
//approve过程
    let txData = {
        to: Contract_R2USD, 
        data: `0x095ea7b3${formHexData(Contract_sR2UR2USD.substring(2))}ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`,
        value: 0,
    };
    await walletSendtxData(wallet,txData);
    await sleep(10)
    console.log(`111111111111111111111111111`);

    txData = {
        to: Contract_sR2USD, 
        data: `0x095ea7b3${formHexData(Contract_sR2UR2USD.substring(2))}ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`,
        value: 0,
    };
    await walletSendtxData(wallet,txData);
    await sleep(10)
    console.log(`22222222222222222222222222`);

    // const randdata=Math.floor(Math.random()*(5-1)+1);
    txData = {
        to: Contract_sR2UR2USD, 
        data: `0xa7256d09${'0'.repeat(62)}60${formHexData(BigInt(ethers.parseUnits((Math.floor(deposit_amount)*2-5).toString(),sR2UR2USD_decimal)).toString(16))}${formHexData(address.substring(2))}${'0'.repeat(63)}2${formHexData(BigInt(ethers.parseUnits(deposit_amount.toString(),R2USD_decimal)).toString(16))}${formHexData(BigInt(ethers.parseUnits(deposit_amount.toString(),sR2USD_decimal)).toString(16))}`,
        value: 0,
    };
    await walletSendtxData(wallet,txData);
    await sleep(10)
    console.log(`333333333333333333333333333333`);
}

//deposit_WBTC函数
async function deposit_WBTC(wallet,Contract_WBTC,WBTC_amount,WBTC_decimal){
    const address=wallet.address;
    console.log(`deposit_WBTC过程。。。。。。。。。。。。。。。。。。`);
    let Interacted_contract_Token='0x23b2615d783e16f14b62efa125306c7c69b4941a';
    // const randdata=Math.floor(Math.random()*(5-1)+1);
    let txData = {
        to: Contract_WBTC, 
        data: `0x095ea7b3${formHexData(Interacted_contract_Token.substring(2))}ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`,
        value: 0,
    };
    await walletSendtxData(wallet,txData);
    await sleep(2)
    txData = {
        to: Interacted_contract_Token, 
        data: `0xadc9772e${formHexData(Contract_WBTC.substring(2))}${formHexData(BigInt(ethers.parseUnits(WBTC_amount.toString(),WBTC_decimal)).toString(16))}`,
        value: 0,
    };
    await walletSendtxData(wallet,txData);
    await sleep(3)  

}

const Contract_sR2USD_index=(index)=>{
    if (index===1) {//index===0 || index===2 || index===3  || index===4|| index===5
        return `0x006cbf409ca275ba022111db32bdae054a97d488`
    }else {
        return `0x006cbf409ca275ba022111db32bdae054a97d488` 

    }
}
const Contract_sR2UR2USD_index=(index)=>{
    if (index===0) {
        return `0xe85a06c238439f981c90b2c91393b2f3c46e27fc`
    }
    if (index===1) {
        return `0x58f68180a997da6f9b1af78aa616d8dfe46f2531`
    }
    if (index===2) {
        return `0x5DfEC10AE4EFdCBA51251F87949ae70fC6a36B5B`
    }
    if (index===3 || index===4|| index===5) {//后面有具体合约地址需要更换
        return null
    }
}
const main=async(privateKeys)=>{
    const Contract_WBTC=`0x4f5b54d4af2568cefafa73bb062e5d734b55aa05`
    const Contract_R2WBTC=`0xdcb5c62eac28d1efc7132ad99f2bd81973041d14`
    const Contract_USDC=`0x8bebfcbe5468f146533c182df3dfbf5ff9be00e2`    
    const Contract_R2USD=`0x9e8ff356d35a2da385c546d6bf1d77ff85133365`
    const limit = pLimit(CONCURRENCY_LIMIT);
    //其余任务
    const tasks=privateKeys.map(privateKey=>
        limit(async ()=>{
            for (let index =0; index < RPC.length; index++) {
                const provider =await RPC_provider(RPC[index])
                console.log(`当前RPC连接是：${RPC[index]}`);
                const wallet=new ethers.Wallet(privateKey,provider)
                console.log(wallet.address);
                
                const Contract_sR2USD=Contract_sR2USD_index(index)
                const Contract_sR2UR2USD=Contract_sR2UR2USD_index(index)
                const USDC_decimal=await getTokenDecimals(Contract_USDC,bulbaswapWETHABI,wallet)//USDC的decimal
                let USDC_amount=await getTokenBalance(Contract_USDC,bulbaswapWETHABI,wallet);//USDC数量
                
                const R2USD_decimal=await getTokenDecimals(Contract_R2USD,bulbaswapWETHABI,wallet)//R2USD的decimal
                let R2USD_amount=await getTokenBalance(Contract_R2USD,bulbaswapWETHABI,wallet);//R2USD数量
                
                const sR2USD_decimal=await getTokenDecimals(Contract_sR2USD,bulbaswapWETHABI,wallet);//sR2USDdecimal              
                let sR2USD_amount=await getTokenBalance(Contract_sR2USD,bulbaswapWETHABI,wallet);//sR2USD数量
                // console.log(R2USD_amount);
                // console.log(sR2USD_amount);
                let sR2UR2USD_decimal=0;
                let sR2UR2USD_amount=0;
                if (index===0 || index===1 || index===2) {
                    sR2UR2USD_decimal=await getTokenDecimals(Contract_sR2UR2USD,bulbaswapWETHABI,wallet);//sR2UR2USDdecimal
                    sR2UR2USD_amount=await getTokenBalance(Contract_sR2UR2USD,bulbaswapWETHABI,wallet);//sR2UR2USD数量      
                }
                let WBTC_amount=0;
                let WBTC_decimal=0;
                if (index==0) {
                    WBTC_amount=await getTokenBalance(Contract_WBTC,bulbaswapWETHABI,wallet);//USDC数量
                    WBTC_decimal=await getTokenDecimals(Contract_WBTC,bulbaswapWETHABI,wallet);//sR2UR2USDdecimal
                }
                
                if (index===0 && WBTC_amount >0) {
                    await deposit_WBTC(wallet,Contract_WBTC,WBTC_amount,WBTC_decimal)
                }
                if (USDC_amount>0) {
                    console.log(`USDC的数量是${USDC_amount}`);
                    await USDC_R2USD(wallet,Contract_USDC,Contract_R2USD,USDC_amount,USDC_decimal);   
                }
                console.log(`交易前，R2USD的数量是${R2USD_amount},sR2USD的数量是${sR2USD_amount},sR2UR2USD的数量是${sR2UR2USD_amount}`);
                R2USD_amount=await getTokenBalance(Contract_R2USD,bulbaswapWETHABI,wallet);//R2USD数量
                
                let stake_R2USD_amount=0;
                if (index===0 || index===1 || index===2) {
                    stake_R2USD_amount=Math.floor((R2USD_amount-sR2USD_amount)/2)-5;
                }else{
                    stake_R2USD_amount=R2USD_amount;
                }
                
                if (stake_R2USD_amount>5) {
                    await stake_R2USD_sR2USD(wallet,stake_R2USD_amount,Contract_R2USD,Contract_sR2USD,R2USD_decimal)    
                    await sleep(5)
                }
                R2USD_amount=await getTokenBalance(Contract_R2USD,bulbaswapWETHABI,wallet);//R2USD数量
                sR2USD_amount=await getTokenBalance(Contract_sR2USD,bulbaswapWETHABI,wallet);//sR2USD数量
                let deposit_amount=0;
                if(index===0 || index===1 || index===2){
                    deposit_amount=Math.floor((R2USD_amount > sR2USD_amount)?(sR2USD_amount-10):(R2USD_amount-10));//存的单边数量是多少
                }
                console.log(`${deposit_amount}`);
                if (deposit_amount>5) {
                    await deposit_R2USD_sR2USD(wallet,deposit_amount,Contract_R2USD,Contract_sR2USD,Contract_sR2UR2USD,R2USD_decimal,sR2USD_decimal,sR2UR2USD_decimal)    
                }
                await sleep(2);      
                R2USD_amount=await getTokenBalance(Contract_R2USD,bulbaswapWETHABI,wallet);//R2USD数量
                sR2USD_amount=await getTokenBalance(Contract_sR2USD,bulbaswapWETHABI,wallet);//sR2USD数量
                if (index===0 || index===1 || index===2) {
                    sR2UR2USD_amount=await getTokenBalance(Contract_sR2UR2USD,bulbaswapWETHABI,wallet);//sR2UR2USD数量      
                }    
                console.log(`交易后，R2USD的数量是${R2USD_amount},sR2USD的数量是${sR2USD_amount},sR2UR2USD的数量是${sR2UR2USD_amount}`);
                
            }
  
        })
     );
     await Promise.allSettled(tasks)
     .then(()=>
         console.log(`任务已完成`)
     )
     .catch(error=>{
         console.error(error.message);
     });
}

main(await readTxtFile('D:/python/ethers/hhplume.txt')).catch(error=>{//替换自己的密钥脚本
    console.error(error.message);  
})