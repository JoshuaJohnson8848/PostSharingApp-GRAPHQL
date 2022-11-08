const { buildSchema } = require('graphql');

module.exports = new buildSchema(`

type Post {
    _id: ID!
    title: String!
    imageUrl: String!
    content: String!
    creator: User!
    createdAt: String!
    updatedAt: String!
}

type PostData {
    posts: [Post!]!
    totalPosts: Int!
}

type User {
    _id: ID!
    email: String!
    name: String!
    password: String!
    status: String!
    posts: [Post!]!
}

type AuthData {
    token: String!
    userId: String!
}

input PostInputData {
    title: String!
    content: String!
    imageUrl: String!
}

input UserInputData {
    email: String!
    name: String!
    password: String!
}

type RootQuery {
    login(email: String!, password: String!): AuthData!
    posts(page: Int): PostData!
    post(id: ID!):Post!
    user: User!
    
}

type RootMutation {
    createUser(userInput: UserInputData): User!
    createPost(postInput: PostInputData): Post!
    updatePost(id :ID!, postInput: PostInputData): Post!
    deletePost(id: ID!): Boolean
    updateStatus(status: String!): User!
}

schema {
    query: RootQuery
    mutation: RootMutation
}

`);
