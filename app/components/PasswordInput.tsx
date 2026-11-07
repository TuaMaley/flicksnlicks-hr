'use client';
import {useState, type InputHTMLAttributes} from 'react';
import {Eye, EyeOff} from 'lucide-react';
import styles from './PasswordInput.module.css';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;
/** Passwords are masked by default; each field controls its own visibility. */
export default function PasswordInput(props: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <span style={{position:'relative',display:'block',width:'100%',maxWidth:450}}>
      <input {...props} className={[styles.passwordInput, props.className].filter(Boolean).join(' ')} type={visible ? 'text' : 'password'} style={{...props.style,width:'100%',maxWidth:'none',paddingRight:46,boxSizing:'border-box'}} />
      <button type="button" aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible} title={visible ? 'Hide password' : 'Show password'}
        onClick={() => setVisible(v => !v)}
        style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',
          border:0,background:'transparent',color:'#64748b',cursor:'pointer',
          display:'flex',alignItems:'center',justifyContent:'center',padding:6,zIndex:1}}>
        {visible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
      </button>
    </span>
  );
}
