FROM "node"

WORKDIR /tinyswords-api

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

COPY entrypoint.sh ./

RUN chmod +x entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["./entrypoint.sh"]