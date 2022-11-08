const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');

const User = require('../models/user');
const Post = require('../models/post');
const isAuth = require('../middleware/isAuth');
const { clearImage } = require('../util/clearImage');

module.exports = {
  createUser: async ({ userInput }, req) => {
    const errors = [];
    if (!validator.isEmail(userInput.email)) {
      errors.push({ message: 'Invalid Email' });
    }
    if (
      validator.isEmpty(userInput.password) ||
      !validator.isLength(userInput.password, { min: 5 })
    ) {
      errors.push({ message: 'Invalid Password' });
    }
    if (errors.length > 0) {
      const error = new Error('Invalid Input');
      error.data = errors;
      error.code = 422;
      throw error;
    }
    const existingUser = await User.findOne({ email: userInput.email });
    if (existingUser) {
      const error = new Error('Email Already Exist');
      throw error;
    }
    const hashPass = await bcrypt.hash(userInput.password, 12);
    const user = new User({
      email: userInput.email,
      name: userInput.name,
      password: hashPass,
    });
    const userCreated = await user.save();

    return { ...userCreated._doc, _id: userCreated._id.toString() };
  },

  login: async ({ email, password }) => {
    const user = await User.findOne({ email: email });
    if (!user) {
      const error = new Error(' User Not Found');
      error.code = 404;
      throw error;
    }
    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) {
      const error = new Error('Invalid Password');
      error.code = 404;
      throw error;
    }
    const token = jwt.sign(
      {
        email: user.email,
        userId: user._id.toString(),
      },
      'somesupersupersecret',
      {
        expiresIn: '1h',
      }
    );
    return { token: token, userId: user._id.toString() };
  },

  createPost: async ({ postInput }, req) => {
    const errors = [];
    if (!isAuth) {
      const error = new Error('Not Authenticated');
      error.code = 401;
    }
    if (validator.isEmpty(postInput.title)) {
      errors.push({ message: 'Invalid Title' });
    }
    if (
      validator.isEmpty(postInput.content) ||
      !validator.isLength(postInput.content, { min: 5 })
    ) {
      errors.push({ message: 'Invalid Content' });
    }
    if (errors.length > 0) {
      console.log(errors);
      const error = new Error('Invalid Input');
      error.data = errors;
      error.code = 422;
      throw error;
    }
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error('User Not Found');
      error.code = 404;
      throw error;
    }
    const post = new Post({
      title: postInput.title,
      content: postInput.content,
      imageUrl: postInput.imageUrl,
      creator: user,
    });
    const createdPost = await post.save();
    user.posts.push(createdPost);
    await user.save();
    return {
      ...createdPost._doc,
      _id: createdPost._id.toString(),
      createdAt: createdPost.createdAt.toString(),
      updatedAt: createdPost.updatedAt.toString(),
    };
  },
  posts: async ({ page }, req) => {
    if (!isAuth) {
      const error = new Error('Not Authenticated');
      error.code = 401;
      throw error;
    }
    if (!page) {
      page = 1;
    }
    const perPage = 2;
    const totalPosts = await Post.find().countDocuments();
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .populate('creator');
    return {
      posts: posts.map((p) => {
        return {
          ...p._doc,
          _id: p._id.toString(),
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        };
      }),
      totalPosts: totalPosts,
    };
  },
  post: async ({ id }, req) => {
    if (!isAuth) {
      const error = new Error('Not Authenticated');
      error.code = 401;
      throw error;
    }
    const post = await Post.findById(id).populate('creator');
    if (!post) {
      const error = new Error('No Post Found');
      error.code = 404;
      throw error;
    }
    return {
      ...post._doc,
      _id: post.id.toString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  },
  updatePost: async ({ id, postInput }, req) => {
    const errors = [];
    if (!isAuth) {
      const error = new Error('Not Authenticated');
      error.code = 401;
    }
    const existingPost = await Post.findById(id).populate('creator');
    if (!existingPost) {
      const error = new Error('No Post Found');
      error.code = 404;
      throw error;
    }
    if (existingPost.creator._id.toString() !== req.userId.toString()) {
      const error = new Error('Not Authenticated');
      error.code = 403;
      throw error;
    }
    if (validator.isEmpty(postInput.title)) {
      errors.push({ message: 'Invalid Title' });
    }
    if (
      validator.isEmpty(postInput.content) ||
      !validator.isLength(postInput.content, { min: 5 })
    ) {
      errors.push({ message: 'Invalid Content' });
    }
    if (errors.length > 0) {
      console.log(errors);
      const error = new Error('Invalid Input');
      error.data = errors;
      error.code = 422;
      throw error;
    }
    existingPost.title = postInput.title;
    existingPost.content = postInput.content;
    if (postInput.imageUrl !== 'undefined') {
      existingPost.imageUrl = postInput.imageUrl;
    }
    const updatedPost = await existingPost.save();
    return {
      ...updatedPost._doc,
      _id: updatedPost._id.toString(),
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString(),
    };
  },

  deletePost: async ({ id }, req) => {
    if (!isAuth) {
      const error = new Error('Not Authenticated');
      error.code = 401;
    }
    const post = await Post.findById(id);
    if (!post) {
      const error = new Error('No Post Found');
      error.code = 404;
      throw error;
    }
    if (post.creator.toString() !== req.userId.toString()) {
      const error = new Error('Not Authenticated');
      error.code = 403;
      throw error;
    }
    clearImage(post.imageUrl);
    await Post.findByIdAndRemove(id);
    const user = await User.findById(req.userId);
    user.posts.pull(id);
    await user.save();
    return true;
  },
  user: async (args, req) => {
    if (!isAuth) {
      const error = new Error('Not Authenticated');
      error.code = 401;
    }
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error('User Not Found');
      error.code = 404;
      throw error;
    }
    return {
      ...user._doc,
      id: user._id.toString(),
    };
  },

  updateStatus: async ({ status }, req) => {
    if (!isAuth) {
      const error = new Error('Not Authenticated');
      error.code = 401;
    }
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error('User Not Found');
      error.code = 404;
      throw error;
    }
    user.status = status;
    await user.save();
    return {
      ...user._doc,
      _id: user._id.toString(),
    };
  },
};
