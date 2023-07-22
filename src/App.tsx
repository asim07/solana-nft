import { useMemo } from "react";
import {Route, Routes, BrowserRouter as Router} from 'react-router-dom'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider, } from '@solana/wallet-adapter-react-ui';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { GlowWalletAdapter, PhantomWalletAdapter, SlopeWalletAdapter, SolflareWalletAdapter, TorusWalletAdapter } from '@solana/wallet-adapter-wallets';
import '@solana/wallet-adapter-react-ui/styles.css'
import { SnackbarProvider } from 'notistack';

import Raffle from './pages/raffle'
import RaffleView from './pages/raffle_view'

import './bootstrap.min.css';
import './chunk.css'
import 'antd/dist/antd.css';
import './assets/style.scss'

export default function App(){
  const network = WalletAdapterNetwork.Mainnet
  const endpoint = 'https://damp-patient-pond.solana-mainnet.quiknode.pro/83ac085a56368f1e6f448af00cd55c18579bb2b6/'
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SlopeWalletAdapter(),
    new GlowWalletAdapter(),
    new SolflareWalletAdapter({ network }),
    new TorusWalletAdapter()
  ], [network]);
  
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <SnackbarProvider>
              <Router>
                <Routes>
                  <Route path="/" element={<Raffle/>}/>
                  <Route path="/:id" element={<RaffleView/>}></Route>
                </Routes>
              </Router>
            </SnackbarProvider>
          </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );  
}