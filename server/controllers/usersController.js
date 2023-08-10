const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

// Logging in is handled by comparing Hash received by front-end and hash in the DB
module.exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.json({ msg: "Incorrect Username ", status: false });
    let password2 =
      password + crypto.createHash("md5").update(password).digest("hex");
    password2 = password2.slice(0, 16);
    const isPasswordValid = await bcrypt.compare(password2, user.password);
    if (!isPasswordValid)
      return res.json({ msg: "Incorrect Password", status: false });
    delete user.password;
    return res.json({ status: true, user });
  } catch (ex) {
    next(ex);
  }
};

// Funtion that handles crating RSA encrypted key pairs for new user
module.exports.register = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    let longPassword =
      password + crypto.createHash("md5").update(password).digest("hex");
    longPassword = longPassword.slice(0, 16);
    const usernameCheck = await User.findOne({ username });
    if (usernameCheck)
      return res.json({ msg: "Username already used", status: false });
    const hashedPassword = await bcrypt.hash(longPassword, 10);

    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 1024,
      publicKeyEncoding: {
        type: "pkcs1",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs1",
        format: "pem",
      },
    });

    const algorithm = "aes-128-cbc";

    // generate 16 bytes of random data, keeping it same so it is easy to decrypt.
    // Does not make it too easy to decrypt even with an easy to guess init vector
    const initVector = "0000000000000000";
    const Securitykey = longPassword;
    // the cipher function
    const cipher = crypto.createCipheriv(algorithm, Securitykey, initVector);

    let encryptedData = cipher.update(privateKey, "utf-8", "hex");

    encryptedData += cipher.final("hex");
    const encryptedPrivateKey = encryptedData;

    const user = await User.create({
      username,
      password: hashedPassword,
      publicKey,
      encryptedPrivateKey,
    });
    delete user.password; // This should not be deleted on the local React app side so that it can be used
    // to decrypt the private key
    return res.json({ status: true, user });
  } catch (ex) {
    next(ex);
  }
};

module.exports.setAvatar = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const avatarImage = req.body.image;
    const userData = await User.findByIdAndUpdate(
      userId,
      {
        isAvatarImageSet: true,
        avatarImage,
      },
      { new: true }
    );
    return res.json({
      isSet: userData.isAvatarImageSet,
      image: userData.avatarImage,
    });
  } catch (ex) {
    next(ex);
  }
};

// gets a list of all users from the DB
module.exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({
      _id: { $ne: req.params.id },
    }).select(["username", "avatarImage", "_id", "publicKey"]);
    return res.json(users);
  } catch (err) {
    next(err);
  }
};

// Logs user out by removing their token (id) from the backend memory
module.exports.logOut = (req, res, next) => {
  try {
    if (!req.params.id) return res.json({ msg: "User id is required " });
    onlineUsers.delete(req.params.id);
    return res.status(200).send();
  } catch (ex) {
    next(ex);
  }
};
