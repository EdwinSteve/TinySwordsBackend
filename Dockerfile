FROM "node"

WORKDIR /tinyswords-api

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 4000

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

CMD ["./entrypoint.sh"]
