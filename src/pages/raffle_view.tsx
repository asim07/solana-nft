import { useState, useEffect, useMemo } from 'react';
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useParams } from "react-router-dom"
import {Connection,Keypair,PublicKey,Transaction,ConfirmOptions,clusterApiUrl,SYSVAR_RENT_PUBKEY,SYSVAR_CLOCK_PUBKEY} from '@solana/web3.js'
import {TOKEN_PROGRAM_ID,ASSOCIATED_TOKEN_PROGRAM_ID} from "@solana/spl-token";
import * as anchor from "@project-serum/anchor";
import { programs } from '@metaplex/js'
import {WalletConnect} from '../wallet'
import Logo from '../assets/mark.png'
import {CircularProgress} from '@mui/material'
import TestImage from '../assets/test.png'
import DiscordImage from '../assets/discord.png'
import TwitterImage from '../assets/twitter.png'
import useNotify from './notify'

let wallet : any
let notify : any
const { metadata: { Metadata } } = programs
const programId = new PublicKey('rafPULFHgk69BgQEZWXedNbCbdwDnwvFr6gRRwGYG3E')
const raffleSystem = new PublicKey('4bkwmdqmoJ3PXVp9KAaQFonT1m6L45FPMNAfViz5gu5W')
const raffleToken = new PublicKey('7VEyj9ooKPLaxd4rxwRWB4J5Yo1upymWwNs7RL78i8Nj')
const decimals = 0
const idl = require('./raffle.json')
const confirmOption : ConfirmOptions = {commitment : 'finalized',preflightCommitment : 'finalized',skipPreflight : false}

const RAFFLE_SIZE = 8+32+50+200+100+100+1+8+4+4+8+8+32+32+1+100;


export default function Raffle(){
	wallet = useWallet()
    notify = useNotify()
    const {connection: conn} = useConnection()
    const {id} = useParams()
	
	const [program] = useMemo(()=>{
		const provider = new anchor.AnchorProvider(conn, wallet as any, confirmOption)
		const program = new anchor.Program(idl, programId, provider)
		return [program]
	}, [])

    const [raffleDetail, setRaffleDetail] = useState<any>(null)
    const [time, setTime] = useState<any>({day : 0, hour : 0, min : 0, sec : 0})
    const [remainingTime, setRemainingTime] = useState(0)
    const [ticketNum, setTicketNum] = useState("1")
    const [myTicketNum, setMyTicketNum] = useState(0)
    useEffect(()=>{
        getRaffleDetail()
    },[])

    useEffect(()=>{
        let interval = setInterval(()=>{
            getRemainingTime()
            setRemainingTime(remainingTime-1)
        },1000)
        return ()=>clearInterval(interval)
    },[remainingTime])

    useEffect(()=>{
        getMyTicket()
    },[wallet, wallet.publicKey])

    const getRemainingTime = () =>{
        let num = remainingTime
        if(num < 0){
            setTime({day : 0, hour : 0, min : 0, sec : 0})
        }else{
            let day = Math.floor(num/86400)
            num -= day*86400
            let hour = Math.floor(num/3600)
            num -= hour*3600
            let min = Math.floor(num/60)
            let sec = num - min*60
            setTime({day : day, hour : hour, min : min, sec : sec})
        }
    }

    const createAssociatedTokenAccountInstruction = (
        associatedTokenAddress: PublicKey,
        payer: PublicKey,
        walletAddress: PublicKey,
        splTokenMintAddress: PublicKey
        ) => {
        const keys = [
          { pubkey: payer, isSigner: true, isWritable: true },
          { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
          { pubkey: walletAddress, isSigner: false, isWritable: false },
          { pubkey: splTokenMintAddress, isSigner: false, isWritable: false },
          {
            pubkey: anchor.web3.SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          {
            pubkey: anchor.web3.SYSVAR_RENT_PUBKEY,
            isSigner: false,
            isWritable: false,
          },
        ];
        return new anchor.web3.TransactionInstruction({
          keys,
          programId: ASSOCIATED_TOKEN_PROGRAM_ID,
          data: Buffer.from([]),
        });
    }
    
    const getTokenWallet = async (owner: PublicKey,mint: PublicKey) => {
        return (
          await PublicKey.findProgramAddress(
            [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        )[0];
    }

    const getMyTicket = async() => {
        try{
            if(raffleDetail && wallet.connected){
                let total=0;
                (raffleDetail.ledger as any[]).map((item)=>{
                    if(item.toBase58()===wallet.publicKey.toBase58()){
                        total++;
                    }
                })
                setMyTicketNum(total)
            }else{
                setMyTicketNum(0)
            }
        }catch(err){
            setMyTicketNum(0)
        }
    }

    const getRaffleDetail = async() => {
        try{
            if(id === undefined) throw new Error("Invalid Raffle")
            let raffleAddress = new PublicKey(id)
            let raffleData = await program.account.raffle.fetch(raffleAddress) as any
            let spotStore = await program.account.spotStore.fetch(raffleData.spotsAccount) as any
            let ledger = await program.account.ledger.fetch(raffleData.ledgerAccount) as any
            setRaffleDetail({...raffleData, spotStore : spotStore.spots, ledger : ledger.users})
            let currentTime = Math.floor((new Date()).getTime()/1000);
            setRemainingTime(raffleData.startTime.toNumber()+raffleData.period.toNumber()-currentTime)
            getMyTicket()
        }catch(err){
            console.log(err)
            setRaffleDetail(null)
        }
    }

    async function sendTransaction(transaction : Transaction, signers : Keypair[]) {
		transaction.feePayer = wallet.publicKey
		transaction.recentBlockhash = (await conn.getRecentBlockhash('max')).blockhash;
		await transaction.setSigners(wallet.publicKey,...signers.map(s => s.publicKey));
		if(signers.length !== 0) await transaction.partialSign(...signers)
		const signedTransaction = await wallet.signTransaction(transaction);
		let hash = await conn.sendRawTransaction(await signedTransaction.serialize());
		await conn.confirmTransaction(hash);
		return hash
	}

    const buyTicket = async() =>{
        try{
            if(id === undefined) throw new Error("Invalid Raffle")
            let transaction = new Transaction()
            transaction.add(program.instruction.buyTicket(
                new anchor.BN(Number(ticketNum)),
                {
                    accounts:{
                        owner : wallet.publicKey,
                        raffleSystem : raffleSystem,
                        raffle : new PublicKey(id),
                        ledger : raffleDetail.ledgerAccount,
                        tokenFrom : await getTokenWallet(wallet.publicKey, raffleToken),
                        tokenTo : await getTokenWallet(raffleSystem, raffleToken),
                        tokenProgram : TOKEN_PROGRAM_ID,
                        clock : SYSVAR_CLOCK_PUBKEY
                    }
                }
            ))
            await sendTransaction(transaction, [])
            notify("success", "Success!")
        }catch(err){
            notify('error', 'Failed Transaction')
            console.log(err)
        }
    }

    const claim = async(index : number, nft : PublicKey) => {
        try{
            if(id === undefined) throw new Error("Invalid Raffle")
            let transaction = new Transaction()
            let nftTo = await getTokenWallet(wallet.publicKey, nft)
            if((await conn.getAccountInfo(nftTo))==null)
                transaction.add(createAssociatedTokenAccountInstruction(nftTo, wallet.publicKey, wallet.publicKey, nft))
            transaction.add(program.instruction.claimNft(new anchor.BN(index),{accounts:{
                owner : wallet.publicKey,
                raffleSystem : raffleSystem,
                raffle : new PublicKey(id),
                spotStore : raffleDetail.spotsAccount,
                ledger : raffleDetail.ledgerAccount,
                nftFrom : await getTokenWallet(raffleSystem, nft),
                nftTo : nftTo,
                tokenProgram : TOKEN_PROGRAM_ID
            }}))
            await sendTransaction(transaction, [])
            notify("success", "Success!")
        }catch(err){
            notify('error', 'Failed Transaction')
            console.log(err)
        }        
    }

	return <div >
		<div className='row' style={{padding : "10px"}}>
			<div style={{float : "right"}}>
				<WalletConnect/>
			</div>
		</div>
		<div className='m-2' style={{width : "100%", textAlign : 'center'}}>
			<img src={Logo} alt={"logo"} style={{width : '300px'}}></img>
		</div>
        {
            raffleDetail===null ?
                <div>
                    <CircularProgress size="15rem" disableShrink color="inherit"></CircularProgress>
                </div>
            :
            raffleDetail.status===1 ?
                <div className='content'>
                    <div className='detail-panel row'>
                        <div className='card'>
                            <h3 className='mb-3'>{raffleDetail.roomName}</h3>
                            <div className='row sub-title mb-3'>
                                <div className='col-sm-4'>
                                    🎟️ Tickets sold : {raffleDetail.ledger.length}
                                </div>
                                <div className="col-sm-4">
                                    🔥 $DED spent : {raffleDetail.ledger.length * raffleDetail.ticketValue.toNumber() / (10**decimals)}
                                </div>
                                <div className="col-sm-4">
                                    👑 My tickets : {myTicketNum}
                                </div>
                            </div>
                            <div className='mb-3'>
                                <a href={raffleDetail ? raffleDetail.discord : ""}><img src={DiscordImage} style={{height : "40px", width : "40px"}} alt="discord"></img></a>
                                <a href={raffleDetail ? raffleDetail.twitter : ""}><img src={TwitterImage} style={{height : "40px", width : "40px"}} alt="twitter"></img></a>
                            </div>
                            <div className='row'>
                                <div className='col-md-4' style={{minWidth:"190px", minHeight : "190px"}}>
                                    <img className='card-img-top' src={raffleDetail.logo !== "" ? raffleDetail.logo : TestImage} alt="test"></img>
                                </div>
                                <div className='col-md-8 info'>
                                    <p className='mb-3'>NFT : {raffleDetail.spotNum}</p>
                                    <p className='mb-3'>Price : {raffleDetail.ticketValue.toNumber() / (10**decimals)} $DED/ticket</p>
                                    <p className="mb-3">MAX TICKET COUNT : {raffleDetail.maxTicketNum}</p>
                                    <p className='mb-3'>Remaining Time : {time.day}Day(s) {time.hour}Hour(s) {time.min}Min(s) {time.sec}Sec(s)</p>
                                    <div className='row'>
                                        <div className='col-sm-6'>
                                            <input type="number" className="form-control setting-input" onChange={(e)=>setTicketNum(e.target.value)} value={ticketNum}/>
                                        </div>
                                        <div className='col-sm-6'>
                                            <button type="button" className="btn" onClick={async()=>{
                                                await buyTicket()
                                            }}>BUY TICKET(s)</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            :
                <div className='content'>
                    <div className='result-panel'>
                        <img src={raffleDetail.logo !== "" ? raffleDetail.logo : TestImage} alt="logo"></img>
                        <h3 className='title'>{raffleDetail.roomName}</h3>
                        <div className='mb-3'>
                            <a href={raffleDetail ? raffleDetail.discord : ""}><img src={DiscordImage} style={{height : "40px", width : "40px"}} alt="discord"></img></a>
                            <a href={raffleDetail ? raffleDetail.twitter : ""}><img src={TwitterImage} style={{height : "40px", width : "40px"}} alt="twitter"></img></a>
                        </div>
                        <div className='card'>
                            <table className='table table-striped'>
                                <thead><tr><th>Wallet</th><th>Claim</th></tr></thead>
                                <tbody>
                                {
                                    (raffleDetail.spotStore as any[]).map((item,idx)=>{
                                        return <tr key={idx}>
                                            <td style={{padding : "20px"}}>{raffleDetail.ledger[item.winnerTicket].toBase58()}</td>
                                            <td>
                                            {  
                                                item.claimed ? 
                                                    <p style={{padding : "10px"}}>Claimed</p>
                                                : 
                                                (wallet.publicKey && raffleDetail.ledger[item.winnerTicket].toBase58()===wallet.publicKey.toBase58()) ?
                                                    <button type="button" className='btn btn-success' onClick={async()=>{
                                                        await claim(idx,item.nft)
                                                        await getRaffleDetail()
                                                    }}>Claim</button>
                                                :
                                                    ""
                                            }
                                            </td>
                                        </tr>
                                    })
                                }
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
        }
    </div>
	  
}