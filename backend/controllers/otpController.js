import nodemailer from 'nodemailer';
import crypto from 'crypto';


let otpStore = {}; 


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'unithreads4g@gmail.com', 
    pass: 'rcqd dipz fngw gljx',    
  },
});


const generateOtp = () => {
  return crypto.randomInt(100000, 999999); 
};


const sendOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  
  const otp = generateOtp();


  otpStore[email] = otp;

  const mailOptions = {
    from: 'unithreads4g@gmail.com',  
    to: email,                    
    subject: 'Your OTP Code',  
    text: `Your OTP code is ${otp}. It will expire in 10 minutes.`, 
  };

  try {
 
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'OTP sent successfully!' });
    console.log("Stored OTPs:", otpStore);

  } catch (error) {
    res.status(500).json({ message: 'Error sending OTP email.' });
  }
};



const verifyOtp = (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required." });
  }

  if (otpStore[email] && otpStore[email].toString() === otp) {
    delete otpStore[email]; 
    return res.status(200).json({ message: "OTP verified successfully." });
  } else {
    return res.status(400).json({ message: "Invalid OTP or OTP expired." });
  }
};

export { sendOtp, verifyOtp };

